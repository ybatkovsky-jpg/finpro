import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import { readdir } from 'fs/promises';
import { join } from 'path';

/**
 * POST /api/import-config/1c-auto
 * Trigger auto-import from the configured watch directory.
 * Scans the watchPath for new .txt files and returns a list of found files.
 */
export async function POST() {
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
      requireRole(user, 'owner', 'accountant');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    // Get config
    const config = await db.importConfig.findUnique({
      where: { source: '1c_clientbank' },
    });

    if (!config || !config.watchPath) {
      return NextResponse.json(
        { error: 'Watch path not configured for 1C ClientBank import' },
        { status: 400 }
      );
    }

    if (!config.autoImport) {
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
      return NextResponse.json(
        { error: `Cannot read watch directory: ${config.watchPath}` },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json({
        message: 'No .txt files found in watch directory',
        watchPath: config.watchPath,
        filesFound: 0,
      });
    }

    // Return list of files for processing
    return NextResponse.json({
      message: `Found ${files.length} file(s) in watch directory`,
      watchPath: config.watchPath,
      filesFound: files.length,
      files: files.map((f) => join(config.watchPath!, f)),
    });
  } catch (error) {
    console.error('POST /api/import-config/1c-auto error:', error);
    return NextResponse.json(
      { error: 'Failed to scan watch directory' },
      { status: 500 }
    );
  }
}
