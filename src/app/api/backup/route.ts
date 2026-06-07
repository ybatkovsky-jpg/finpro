/**
 * Database Backup API
 * POST /api/backup — owner only
 * 
 * - SQLite: reads the .db file and returns it as a download
 * - PostgreSQL (detected by DATABASE_URL): runs pg_dump and returns the dump
 * - Logs the backup action in AuditLog
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

function isPostgreSQL(): boolean {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function getSQLitePath(): string {
  const url = process.env.DATABASE_URL || '';
  // SQLite URLs: file:./db/finpro.db or file:./prisma/dev.db
  if (url.startsWith('file:')) {
    return url.replace(/^file:/, '');
  }
  // Fallback
  return path.join(process.cwd(), 'db', 'finpro.db');
}

export async function POST(request: NextRequest) {
  try {
    // RBAC: owner only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }
    try {
      requireRole(user, 'owner');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав. Только собственник может создавать резервные копии.' }, { status: 403 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let backupData: Buffer;
    let filename: string;
    let contentType: string;

    if (isPostgreSQL()) {
      // PostgreSQL: run pg_dump
      filename = `finpro_backup_${timestamp}.sql`;
      contentType = 'application/sql';

      try {
        const { stdout } = await execAsync(`pg_dump "${process.env.DATABASE_URL}"`, {
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        });
        backupData = Buffer.from(stdout, 'utf-8');
      } catch (pgError) {
        logger.error('pg_dump failed', { error: pgError instanceof Error ? pgError.message : String(pgError) });
        return NextResponse.json(
          { error: 'Ошибка создания резервной копии PostgreSQL. Проверьте настройки pg_dump.' },
          { status: 500 }
        );
      }
    } else {
      // SQLite: copy the database file
      const dbPath = getSQLitePath();
      const resolvedPath = path.resolve(dbPath);
      filename = `finpro_backup_${timestamp}.db`;
      contentType = 'application/x-sqlite3';

      try {
        backupData = await readFile(resolvedPath);
      } catch (fileError) {
        logger.error('SQLite backup failed', { error: fileError instanceof Error ? fileError.message : String(fileError), path: resolvedPath });
        return NextResponse.json(
          { error: 'Ошибка чтения файла базы данных SQLite.' },
          { status: 500 }
        );
      }
    }

    // Log the backup action in AuditLog
    await db.auditLog.create({
      data: {
        entityType: 'system',
        entityId: 'database',
        action: 'backup',
        changes: JSON.stringify({
          filename,
          size: backupData.length,
          engine: isPostgreSQL() ? 'postgresql' : 'sqlite',
          timestamp: new Date().toISOString(),
        }),
        userId: user.id,
      },
    });

    logger.info('Database backup created', { filename, size: backupData.length, engine: isPostgreSQL() ? 'postgresql' : 'sqlite' });

    // Return the backup file as a download
    const response = new NextResponse(backupData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(backupData.length),
        'Cache-Control': 'no-store',
      },
    });

    return response;
  } catch (error) {
    logger.error('POST /backup error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Ошибка создания резервной копии' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/backup — check backup capability
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }
    try {
      requireRole(user, 'owner');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    return NextResponse.json({
      engine: isPostgreSQL() ? 'postgresql' : 'sqlite',
      backupPath: process.env.BACKUP_PATH || './backups',
      supported: true,
    });
  } catch (error) {
    logger.error('GET /backup error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to check backup status' },
      { status: 500 }
    );
  }
}
