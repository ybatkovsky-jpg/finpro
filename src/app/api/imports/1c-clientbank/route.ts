import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ParsedDocument {
  number: string;
  date: string;
  amount: number;
  payerOrPayee: string;
  description: string;
}

/**
 * Detect if file content is UTF-8 encoded rather than Windows-1251.
 * 1C ClientBank format standard requires Windows-1251 encoding.
 * Spec: "File in UTF-8 → 400 Bad Request: Invalid encoding. Expected Windows-1251"
 */
function isUtf8Encoded(content: string, rawBytes: Uint8Array): boolean {
  // Check 1: UTF-8 BOM (EF BB BF)
  if (rawBytes.length >= 3 && rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) {
    return true;
  }

  // Check 2: If the text read as UTF-8 contains valid Cyrillic 1C markers,
  // the file was saved as UTF-8, not Windows-1251.
  // Windows-1251 Cyrillic bytes (0xC0-0xFF) read as UTF-8 would produce
  // replacement characters (U+FFFD) or garbled text, not valid Russian words.
  const has1CMarkers = content.includes('СекцияДокумент') || content.includes('КонецФайла');
  if (has1CMarkers) {
    // The Cyrillic markers are readable as UTF-8 → file was UTF-8 encoded
    return true;
  }

  return false;
}

function parse1CClientBank(content: string): ParsedDocument[] {
  const documents: ParsedDocument[] = [];
  const sections = content.split('СекцияДокумент');

  for (const section of sections.slice(1)) {
    // Skip the header before first section
    const lines = section.split('\n').map((l) => l.trim());
    const fields: Record<string, string> = {};

    for (const line of lines) {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();
        fields[key] = value;
      }
    }

    if (!fields['Номер'] && !fields['Дата']) continue;

    documents.push({
      number: fields['Номер'] || '',
      date: fields['Дата'] || '',
      amount: parseFloat(fields['Сумма']) || 0,
      payerOrPayee: fields['Плательщик'] || fields['Получатель'] || '',
      description: fields['Назначение'] || '',
    });
  }

  return documents;
}

function parseRussianDate(dateStr: string): Date | null {
  // Try format: DD.MM.YYYY
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(`${year}-${month}-${day}`);
  }
  // Try ISO format
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

// Keyword-to-category mapping for auto-classification
const keywordMap: Record<string, string> = {
  'дсп': 'ДСП',
  'мдф': 'ДСП',
  'фанер': 'ДСП',
  'фурнитур': 'Фурнитура',
  'петл': 'Фурнитура',
  'направляющ': 'Фурнитура',
  'ручк': 'Фурнитура',
  'ткань': 'Ткань',
  'обивк': 'Ткань',
  'поролон': 'Поролон',
  'зарплат': 'Зарплата',
  'аренд': 'Аренда',
  'транспорт': 'Транспорт',
  'доставк': 'Транспорт',
  'реклам': 'Реклама',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Use "file" field in FormData.' },
        { status: 422 }
      );
    }

    // Read raw bytes for encoding detection
    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);

    // Read as text (UTF-8 by default)
    const content = new TextDecoder().decode(rawBytes);

    // Encoding check: reject UTF-8 files, require Windows-1251
    if (isUtf8Encoded(content, rawBytes)) {
      return NextResponse.json(
        { error: 'Invalid encoding. Expected Windows-1251' },
        { status: 400 }
      );
    }

    const documents = parse1CClientBank(content);

    let imported = 0;
    let duplicatesSkipped = 0;
    let pendingClassification = 0;
    const errors: string[] = [];

    // Get or create default categories for auto-classification
    const defaultIncomeCategory = await db.category.findFirst({
      where: { type: 'income' },
    });
    const defaultExpenseCategory = await db.category.findFirst({
      where: { type: 'expense' },
    });

    // Pre-load all categories for keyword-based classification
    const allCategories = await db.category.findMany();

    // Get a default user for createdBy
    const defaultUser = await db.user.findFirst();

    for (const doc of documents) {
      try {
        const parsedDate = parseRussianDate(doc.date);
        if (!parsedDate) {
          errors.push(`Invalid date for document ${doc.number}: ${doc.date}`);
          continue;
        }

        if (doc.amount <= 0) {
          errors.push(`Invalid amount for document ${doc.number}: ${doc.amount}`);
          continue;
        }

        // Determine transaction type based on description or amount sign
        // In 1C ClientBank format, we typically need additional context
        // For now, default to expense if amount is debited, income if credited
        const type = doc.amount > 0 ? 'expense' : 'income';
        const absAmount = Math.abs(doc.amount);

        // Deduplication: check if transaction with same Номер+Дата (externalId+source+date) exists
        // Spec: "Re-import same Номер+Дата → duplicates_skipped += 1, no duplicates in DB"
        const existing = await db.transaction.findUnique({
          where: {
            externalId_source_date: {
              externalId: doc.number,
              source: '1c_clientbank',
              date: parsedDate,
            },
          },
        });

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        // Auto-classify: try to match project by regex on description
        const projectMatch = doc.description.match(/проект\s*№\s*(ПМ\d+)/i);
        let projectId: string | null = null;
        let requiresClassification = false;
        let categoryId: string | undefined;

        if (projectMatch) {
          const externalId = projectMatch[1];
          const project = await db.project.findUnique({
            where: { externalId },
          });
          if (project) {
            projectId = project.id;
          } else {
            requiresClassification = true;
          }
        }

        // --- Counterparty-based classification ---
        // Find matching counterparty in DB
        if (doc.payerOrPayee) {
          const matchedCounterparty = await db.counterparty.findUnique({
            where: { name: doc.payerOrPayee },
          });

          if (matchedCounterparty) {
            if (matchedCounterparty.type === 'customer') {
              // Customer → income category "Выручка от реализации"
              const revenueCategory = allCategories.find(
                (c) => c.type === 'income' && c.name.toLowerCase().includes('выручк')
              );
              if (revenueCategory) {
                categoryId = revenueCategory.id;
              }
            } else if (matchedCounterparty.type === 'supplier') {
              // Supplier → try keyword-based expense category, or find first matching expense category
              const keywordCategoryName = findKeywordCategoryName(doc.description);
              if (keywordCategoryName) {
                const expenseCat = allCategories.find(
                  (c) => c.type === 'expense' && c.name === keywordCategoryName
                );
                if (expenseCat) {
                  categoryId = expenseCat.id;
                }
              }
              // If no keyword match, try to find an expense category from the counterparty name keywords
              if (!categoryId) {
                const nameKeywordCat = findKeywordCategoryName(doc.payerOrPayee);
                if (nameKeywordCat) {
                  const expenseCat = allCategories.find(
                    (c) => c.type === 'expense' && c.name === nameKeywordCat
                  );
                  if (expenseCat) {
                    categoryId = expenseCat.id;
                  }
                }
              }
            }
          }
        }

        // --- Keyword-based category classification ---
        // If counterparty-based classification didn't yield a category, try keywords
        if (!categoryId) {
          const keywordCategoryName = findKeywordCategoryName(doc.description);
          if (keywordCategoryName) {
            const cat = allCategories.find(
              (c) => c.type === type && c.name === keywordCategoryName
            );
            if (cat) {
              categoryId = cat.id;
            }
          }
        }

        // If still no category found, set requiresClassification
        if (!categoryId) {
          requiresClassification = true;
          // Fallback to default category
          categoryId =
            type === 'income'
              ? defaultIncomeCategory?.id
              : defaultExpenseCategory?.id;
        }

        if (requiresClassification) {
          pendingClassification++;
        }

        // Find or create counterparty
        let counterpartyId: string | null = null;
        if (doc.payerOrPayee) {
          const existingCounterparty = await db.counterparty.findUnique({
            where: { name: doc.payerOrPayee },
          });
          if (existingCounterparty) {
            counterpartyId = existingCounterparty.id;
          } else {
            const newCounterparty = await db.counterparty.create({
              data: { name: doc.payerOrPayee },
            });
            counterpartyId = newCounterparty.id;
          }
        }

        if (!categoryId) {
          errors.push(
            `No default ${type} category found for document ${doc.number}`
          );
          continue;
        }

        if (!defaultUser) {
          errors.push('No user found in system for createdBy field');
          continue;
        }

        await db.transaction.create({
          data: {
            projectId,
            categoryId,
            counterpartyId,
            createdBy: defaultUser.id,
            date: parsedDate,
            amount: absAmount,
            type,
            description: doc.description || null,
            source: '1c_clientbank',
            externalId: doc.number,
            requiresClassification,
          },
        });

        imported++;
      } catch (docError) {
        errors.push(
          `Error processing document ${doc.number}: ${docError instanceof Error ? docError.message : String(docError)}`
        );
      }
    }

    return NextResponse.json({
      totalProcessed: documents.length,
      imported,
      duplicatesSkipped,
      pendingClassification,
      errors,
    });
  } catch (error) {
    console.error('POST /imports/1c-clientbank error:', error);
    return NextResponse.json(
      { error: 'Failed to import 1C ClientBank file' },
      { status: 500 }
    );
  }
}

/**
 * Search the description for keywords and return the matching category name.
 */
function findKeywordCategoryName(description: string): string | null {
  const lowerDesc = description.toLowerCase();
  for (const [keyword, categoryName] of Object.entries(keywordMap)) {
    if (lowerDesc.includes(keyword)) {
      return categoryName;
    }
  }
  return null;
}
