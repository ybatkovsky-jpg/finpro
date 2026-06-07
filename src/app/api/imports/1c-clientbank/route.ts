import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPeriodClosed } from '@/lib/period-guard';
import { logger } from '@/lib/logger';

interface ParsedDocument {
  number: string;
  date: string;
  amount: number;
  payerOrPayee: string;
  description: string;
}

/**
 * Try to decode raw bytes as Windows-1251.
 * Uses TextDecoder with 'windows-1251' encoding label.
 */
function decodeWindows1251(rawBytes: Uint8Array): string {
  try {
    const decoder = new TextDecoder('windows-1251');
    return decoder.decode(rawBytes);
  } catch {
    return '';
  }
}

/**
 * Decode raw bytes as UTF-8.
 */
function decodeUtf8(rawBytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(rawBytes);
}

/**
 * Detect encoding and decode the file content.
 * Strategy:
 *   1. Try Win-1251 decoding first
 *   2. If Win-1251 decoded text contains valid 1C markers, use it
 *   3. If Win-1251 decode fails or no markers, try UTF-8 as fallback
 *   4. Accept both encodings, just log which encoding was detected
 */
function detectAndDecode(rawBytes: Uint8Array): { content: string; encoding: string } {
  // Check for UTF-8 BOM first
  if (rawBytes.length >= 3 && rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) {
    return { content: decodeUtf8(rawBytes), encoding: 'utf-8-bom' };
  }

  // Try Win-1251 first
  const win1251Content = decodeWindows1251(rawBytes);
  if (win1251Content) {
    const has1CMarkers = win1251Content.includes('СекцияДокумент') || win1251Content.includes('КонецФайла');
    if (has1CMarkers) {
      // Content decoded from Win-1251 has valid 1C Cyrillic markers
      return { content: win1251Content, encoding: 'windows-1251' };
    }
  }

  // Try UTF-8 as fallback
  const utf8Content = decodeUtf8(rawBytes);
  const hasUtf8Markers = utf8Content.includes('СекцияДокумент') || utf8Content.includes('КонецФайла');
  if (hasUtf8Markers) {
    return { content: utf8Content, encoding: 'utf-8' };
  }

  // If no markers found in either, return Win-1251 if it had any content, else UTF-8
  if (win1251Content) {
    return { content: win1251Content, encoding: 'windows-1251' };
  }

  return { content: utf8Content, encoding: 'utf-8' };
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

// Hardcoded keyword-to-category mapping as fallback
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

/**
 * Find keyword category name using classification rules first, then fallback to hardcoded map.
 */
async function findClassificationCategory(
  description: string,
  counterpartyName?: string
): Promise<{ categoryId: string | null; projectId: string | null; source: string }> {
  // 1. Check ClassificationRule table (ordered by priority desc)
  const rules = await db.classificationRule.findMany({
    where: { isActive: true },
    include: {
      category: { select: { id: true, name: true, type: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { priority: 'desc' },
  });

  const lowerDesc = description.toLowerCase();
  const lowerCounterparty = (counterpartyName || '').toLowerCase();

  for (const rule of rules) {
    const keywordMatch = lowerDesc.includes(rule.keyword.toLowerCase());
    const counterpartyMatch = !rule.counterpartyKeyword || lowerCounterparty.includes(rule.counterpartyKeyword.toLowerCase());

    if (keywordMatch && counterpartyMatch) {
      return {
        categoryId: rule.categoryId,
        projectId: rule.projectId,
        source: 'classification_rule',
      };
    }
  }

  return { categoryId: null, projectId: null, source: 'none' };
}

/**
 * Fallback: search the description for hardcoded keywords and return the matching category name.
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

    // Detect encoding and decode
    const { content, encoding } = detectAndDecode(rawBytes);
    logger.info('1C Import: detected encoding', { encoding });

    const documents = parse1CClientBank(content);

    if (documents.length === 0 && !content.includes('СекцияДокумент')) {
      return NextResponse.json(
        { error: 'Invalid 1C ClientBank file format. No document sections found.' },
        { status: 400 }
      );
    }

    let imported = 0;
    let duplicatesSkipped = 0;
    let pendingClassification = 0;
    let closedPeriodSkipped = 0;
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

        // Period close check
        const periodCheck = await checkPeriodClosed(parsedDate);
        if (periodCheck.closed) {
          closedPeriodSkipped++;
          errors.push(`Period is closed (${periodCheck.period}) for document ${doc.number}`);
          continue;
        }

        // Determine transaction type based on description or amount sign
        const type = doc.amount > 0 ? 'expense' : 'income';
        const absAmount = Math.abs(doc.amount);

        // Deduplication: check if transaction with same Номер+Дата exists
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

        // Auto-classify using ClassificationRule table first
        let projectId: string | null = null;
        let requiresClassification = false;
        let categoryId: string | undefined;

        const classification = await findClassificationCategory(
          doc.description,
          doc.payerOrPayee
        );

        if (classification.categoryId) {
          categoryId = classification.categoryId;
          if (classification.projectId) {
            projectId = classification.projectId;
          }
        }

        // If classification rules didn't find a match, try project regex match
        if (!projectId) {
          const projectMatch = doc.description.match(/проект\s*№\s*(ПМ\d+)/i);
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
        }

        // Counterparty-based classification (if no category from rules)
        if (!categoryId && doc.payerOrPayee) {
          const matchedCounterparty = await db.counterparty.findUnique({
            where: { name: doc.payerOrPayee },
          });

          if (matchedCounterparty) {
            if (matchedCounterparty.type === 'customer') {
              const revenueCategory = allCategories.find(
                (c) => c.type === 'income' && c.name.toLowerCase().includes('выручк')
              );
              if (revenueCategory) {
                categoryId = revenueCategory.id;
              }
            } else if (matchedCounterparty.type === 'supplier') {
              const keywordCategoryName = findKeywordCategoryName(doc.description);
              if (keywordCategoryName) {
                const expenseCat = allCategories.find(
                  (c) => c.type === 'expense' && c.name === keywordCategoryName
                );
                if (expenseCat) {
                  categoryId = expenseCat.id;
                }
              }
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

        // Keyword-based category classification (hardcoded fallback)
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

    // Update ImportConfig lastImportAt
    await db.importConfig.upsert({
      where: { source: '1c_clientbank' },
      update: { lastImportAt: new Date() },
      create: {
        source: '1c_clientbank',
        autoImport: false,
        autoClassify: true,
        lastImportAt: new Date(),
      },
    });

    return NextResponse.json({
      totalProcessed: documents.length,
      imported,
      duplicatesSkipped,
      pendingClassification,
      closedPeriodSkipped,
      encoding,
      errors,
    });
  } catch (error) {
    logger.error('POST /imports/1c-clientbank error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to import 1C ClientBank file' },
      { status: 500 }
    );
  }
}
