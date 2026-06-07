import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

export async function GET() {
  try {
    // Get 1C import config specifically
    let config = await db.importConfig.findUnique({ where: { source: '1c_clientbank' } });
    if (!config) {
      config = await db.importConfig.create({
        data: {
          source: '1c_clientbank',
          autoImport: false,
          watchPath: '',
          autoClassify: true,
        },
      });
    }
    return NextResponse.json(config);
  } catch (error) {
    console.error('GET /import-config error:', error);
    return NextResponse.json({ error: 'Failed to fetch import config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { autoImport, watchPath, autoClassify, lastImportAt } = body;

    let config = await db.importConfig.findUnique({ where: { source: '1c_clientbank' } });
    if (!config) {
      config = await db.importConfig.create({
        data: {
          source: '1c_clientbank',
          autoImport: autoImport ?? false,
          watchPath: watchPath ?? '',
          autoClassify: autoClassify ?? true,
          lastImportAt: lastImportAt ? new Date(lastImportAt) : null,
        },
      });
    } else {
      config = await db.importConfig.update({
        where: { id: config.id },
        data: {
          ...(autoImport !== undefined && { autoImport }),
          ...(watchPath !== undefined && { watchPath }),
          ...(autoClassify !== undefined && { autoClassify }),
          ...(lastImportAt !== undefined && { lastImportAt: lastImportAt ? new Date(lastImportAt) : null }),
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('PUT /import-config error:', error);
    return NextResponse.json({ error: 'Failed to update import config' }, { status: 500 });
  }
}
