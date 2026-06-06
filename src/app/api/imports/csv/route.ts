import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface CsvRow {
  date: string;
  amount: string;
  type: string;
  description: string;
  project_external_id: string;
  category_name: string;
  counterparty_name: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse control sum from CSV header comments.
 * Supported formats:
 *   # ControlSum:12345.67
 *   # Total:12345.67
 *   # КонтрольнаяСумма:12345.67
 *   # Итого:12345.67
 */
function parseControlSum(lines: string[]): number | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^#\s*(?:ControlSum|Total|КонтрольнаяСумма|Итого)\s*:\s*([\d.,]+)/i);
    if (match) {
      const numStr = match[1].replace(',', '.');
      const value = parseFloat(numStr);
      if (!isNaN(value)) return value;
    }
  }
  return null;
}

function parseCSV(content: string): { rows: CsvRow[]; controlSum: number | null } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], controlSum: null };

  // Extract control sum from header comment lines
  const controlSum = parseControlSum(lines);

  const dataLines = lines.filter((line) => !line.trim().startsWith('#'));
  if (dataLines.length < 2) return { rows: [], controlSum: null };

  const headers = parseCSVLine(dataLines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const requiredHeaders = [
    'date',
    'amount',
    'type',
    'description',
    'project_external_id',
    'category_name',
    'counterparty_name',
  ];

  const headerMap: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    headerMap[headers[i]] = i;
  }

  // Check for required headers
  for (const required of requiredHeaders) {
    if (!(required in headerMap)) {
      throw new Error(`Missing required column: ${required}`);
    }
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < dataLines.length; i++) {
    const values = parseCSVLine(dataLines[i]);
    if (values.length < headers.length) continue;

    rows.push({
      date: values[headerMap['date']] || '',
      amount: values[headerMap['amount']] || '',
      type: values[headerMap['type']] || '',
      description: values[headerMap['description']] || '',
      project_external_id: values[headerMap['project_external_id']] || '',
      category_name: values[headerMap['category_name']] || '',
      counterparty_name: values[headerMap['counterparty_name']] || '',
    });
  }

  return { rows, controlSum };
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

    const content = await file.text();
    const { rows, controlSum } = parseCSV(content);

    let imported = 0;
    const errors: string[] = [];
    const createdTransactionIds: string[] = [];

    // Calculate sum of all valid row amounts for control sum check
    let rowSum = 0;
    for (const row of rows) {
      const amount = parseFloat(row.amount);
      if (!isNaN(amount) && amount > 0 && ['income', 'expense'].includes(row.type)) {
        rowSum += amount;
      }
    }

    // Spec: "CSV sum ≠ sum of rows → ROLLBACK, error in log"
    if (controlSum !== null && Math.abs(controlSum - rowSum) >= 0.01) {
      console.error(
        `CSV control sum mismatch: declared=${controlSum}, actual=${rowSum}. ROLLBACK.`
      );
      return NextResponse.json(
        {
          error: `Control sum mismatch: declared ${controlSum}, actual sum of rows ${Math.round(rowSum * 100) / 100}. Import rolled back.`,
          declaredSum: controlSum,
          actualSum: Math.round(rowSum * 100) / 100,
        },
        { status: 400 }
      );
    }

    // Get default user for createdBy
    const defaultUser = await db.user.findFirst();
    if (!defaultUser) {
      return NextResponse.json(
        { error: 'No user found in system' },
        { status: 500 }
      );
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Parse amount
        const amount = parseFloat(row.amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${i + 1}: Invalid amount "${row.amount}"`);
          continue;
        }

        // Validate type
        if (!['income', 'expense'].includes(row.type)) {
          errors.push(
            `Row ${i + 1}: Invalid type "${row.type}", must be "income" or "expense"`
          );
          continue;
        }

        // Parse date
        const date = new Date(row.date);
        if (isNaN(date.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date "${row.date}"`);
          continue;
        }

        // Find or create project
        let projectId: string | null = null;
        if (row.project_external_id) {
          const existingProject = await db.project.findUnique({
            where: { externalId: row.project_external_id },
          });
          if (existingProject) {
            projectId = existingProject.id;
          } else {
            // Auto-create project
            const newProject = await db.project.create({
              data: {
                externalId: row.project_external_id,
                name: `Project ${row.project_external_id}`,
                status: 'active',
              },
            });
            projectId = newProject.id;
          }
        }

        // Find or create category
        let categoryId: string | null = null;
        if (row.category_name) {
          const existingCategory = await db.category.findUnique({
            where: { name: row.category_name },
          });
          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            const newCategory = await db.category.create({
              data: {
                name: row.category_name,
                type: row.type,
              },
            });
            categoryId = newCategory.id;
          }
        }

        if (!categoryId) {
          // Fallback to default category
          const defaultCat = await db.category.findFirst({
            where: { type: row.type },
          });
          if (!defaultCat) {
            errors.push(`Row ${i + 1}: No category found for type ${row.type}`);
            continue;
          }
          categoryId = defaultCat.id;
        }

        // Find or create counterparty
        let counterpartyId: string | null = null;
        if (row.counterparty_name) {
          const existingCounterparty = await db.counterparty.findUnique({
            where: { name: row.counterparty_name },
          });
          if (existingCounterparty) {
            counterpartyId = existingCounterparty.id;
          } else {
            const newCounterparty = await db.counterparty.create({
              data: { name: row.counterparty_name },
            });
            counterpartyId = newCounterparty.id;
          }
        }

        const transaction = await db.transaction.create({
          data: {
            projectId,
            categoryId,
            counterpartyId,
            createdBy: defaultUser.id,
            date,
            amount,
            type: row.type,
            description: row.description || null,
            source: 'manual',
          },
        });

        createdTransactionIds.push(transaction.id);
        imported++;
      } catch (rowError) {
        errors.push(
          `Row ${i + 1}: ${rowError instanceof Error ? rowError.message : String(rowError)}`
        );
      }
    }

    // Post-import control sum validation: if control sum was declared,
    // verify actual imported total matches the declared total.
    // If mismatch, rollback all created transactions.
    if (controlSum !== null) {
      const importedSum = createdTransactionIds.length > 0
        ? (await db.transaction.findMany({
            where: { id: { in: createdTransactionIds } },
            select: { amount: true },
          })).reduce((sum, t) => sum + t.amount, 0)
        : 0;

      if (Math.abs(controlSum - importedSum) >= 0.01) {
        // ROLLBACK: delete all created transactions
        console.error(
          `CSV post-import control sum mismatch: declared=${controlSum}, imported=${importedSum}. Rolling back ${createdTransactionIds.length} transactions.`
        );
        await db.transaction.deleteMany({
          where: { id: { in: createdTransactionIds } },
        });
        return NextResponse.json(
          {
            error: `Post-import control sum mismatch: declared ${controlSum}, imported ${Math.round(importedSum * 100) / 100}. All imported rows rolled back.`,
            declaredSum: controlSum,
            importedSum: Math.round(importedSum * 100) / 100,
            rolledBack: createdTransactionIds.length,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      totalProcessed: rows.length,
      imported,
      errors,
      controlSumMatch: controlSum !== null ? true : null,
      declaredControlSum: controlSum,
    });
  } catch (error) {
    console.error('POST /imports/csv error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import CSV file' },
      { status: 500 }
    );
  }
}
