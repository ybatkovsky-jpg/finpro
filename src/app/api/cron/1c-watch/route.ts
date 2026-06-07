/**
 * Cron API — POST /api/cron/1c-watch
 * Scans the configured watch directory for new 1C files.
 * Protected by X-API-Key auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/api-key-auth';
import { logger } from '@/lib/logger';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Try to decode raw bytes as Windows-1251.
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
      return { content: win1251Content, encoding: 'windows-1251' };
    }
  }

  // Try UTF-8 as fallback
  const utf8Content = decodeUtf8(rawBytes);
  const hasUtf8Markers = utf8Content.includes('СекцияДокумент') || utf8Content.includes('КонецФайла');
  if (hasUtf8Markers) {
    return { content: utf8Content, encoding: 'utf-8' };
  }

  if (win1251Content) {
    return { content: win1251Content, encoding: 'windows-1251' };
  }

  return { content: utf8Content, encoding: 'utf-8' };
}

export async function POST(request: NextRequest) {
  try {
    // Auth: X-API-Key required
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Требуется X-API-Key для доступа к cron-эндпоинтам' },
        { status: 401 }
      );
    }

    logger.info('Cron 1c-watch: auto-import triggered');

    // Get config
    const config = await db.importConfig.findUnique({
      where: { source: '1c_clientbank' },
    });

    if (!config || !config.watchPath) {
      logger.warn('Cron 1c-watch: watch path not configured');
      return NextResponse.json(
        { error: 'Watch path not configured for 1C ClientBank import' },
        { status: 400 }
      );
    }

    if (!config.autoImport) {
      logger.warn('Cron 1c-watch: auto-import is not enabled');
      return NextResponse.json(
        { error: 'Auto-import is not enabled for 1C ClientBank' },
        { status: 400 }
      );
    }

    // Scan watch directory for .txt files
    let files: string[] = [];
    try {
      const dirEntries = await readdir(config.watchPath);
      files = dirEntries.filter((f) => f.endsWith('.txt'));
    } catch {
      logger.error('Cron 1c-watch: cannot read watch directory', {
        path: config.watchPath,
      });
      return NextResponse.json(
        { error: `Cannot read watch directory: ${config.watchPath}` },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      logger.info('Cron 1c-watch: no .txt files found');
      return NextResponse.json({
        message: 'No .txt files found in watch directory',
        watchPath: config.watchPath,
        filesFound: 0,
        imported: 0,
      });
    }

    logger.info('Cron 1c-watch: found files', {
      count: files.length,
      files,
    });

    // Process each file
    let totalImported = 0;
    let totalErrors = 0;
    const results: Array<{ file: string; imported: number; errors: number }> = [];

    for (const file of files) {
      try {
        const filePath = join(config.watchPath, file);
        const rawBytes = new Uint8Array(await readFile(filePath));
        const { content, encoding } = detectAndDecode(rawBytes);

        logger.info('Cron 1c-watch: processing file', {
          file,
          encoding,
          size: rawBytes.length,
        });

        // Parse 1C documents
        const documents: Array<{
          number: string;
          date: string;
          amount: number;
          payerOrPayee: string;
          description: string;
        }> = [];

        const sections = content.split('СекцияДокумент');
        for (const section of sections.slice(1)) {
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

        let imported = 0;
        let errors = 0;

        for (const doc of documents) {
          try {
            // Parse date
            const match = doc.date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (!match) {
              errors++;
              continue;
            }
            const [, day, month, year] = match;
            const parsedDate = new Date(`${year}-${month}-${day}`);

            if (doc.amount <= 0) {
              errors++;
              continue;
            }

            const type = doc.amount > 0 ? 'expense' : 'income';
            const absAmount = Math.abs(doc.amount);

            // Check for duplicate
            const existing = await db.transaction.findUnique({
              where: {
                externalId_source_date: {
                  externalId: doc.number,
                  source: '1c_clientbank',
                  date: parsedDate,
                },
              },
            });

            if (existing) continue; // Skip duplicate

            // Get default category
            const defaultCategory = await db.category.findFirst({
              where: { type: type === 'income' ? 'income' : 'expense' },
            });

            // Get default user
            const defaultUser = await db.user.findFirst();

            if (!defaultCategory || !defaultUser) {
              errors++;
              continue;
            }

            await db.transaction.create({
              data: {
                categoryId: defaultCategory.id,
                createdBy: defaultUser.id,
                date: parsedDate,
                amount: absAmount,
                type,
                description: doc.description || null,
                source: '1c_clientbank',
                externalId: doc.number,
                requiresClassification: true,
              },
            });

            imported++;
          } catch {
            errors++;
          }
        }

        totalImported += imported;
        totalErrors += errors;
        results.push({ file, imported, errors });
      } catch (err) {
        logger.error('Cron 1c-watch: error processing file', {
          file,
          error: err instanceof Error ? err.message : String(err),
        });
        totalErrors++;
        results.push({ file, imported: 0, errors: 1 });
      }
    }

    // Update ImportConfig lastImportAt
    await db.importConfig.update({
      where: { id: config.id },
      data: { lastImportAt: new Date() },
    });

    // Create sync log
    await db.syncLog.create({
      data: {
        source: '1c_clientbank',
        status: totalErrors > 0 ? 'partial' : 'success',
        recordsTotal: files.length,
        recordsSynced: totalImported,
        errors: totalErrors > 0 ? JSON.stringify(results.filter((r) => r.errors > 0)) : null,
        completedAt: new Date(),
      },
    });

    logger.info('Cron 1c-watch: auto-import completed', {
      filesFound: files.length,
      totalImported,
      totalErrors,
    });

    return NextResponse.json({
      message: `Processed ${files.length} file(s)`,
      watchPath: config.watchPath,
      filesFound: files.length,
      totalImported,
      totalErrors,
      results,
      triggeredBy: 'cron',
    });
  } catch (error) {
    logger.error('Cron 1c-watch: unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Ошибка автозагрузки 1C' },
      { status: 500 }
    );
  }
}
