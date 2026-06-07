import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const periods = await db.periodClose.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { period: 'desc' },
    });

    return NextResponse.json({ data: periods });
  } catch (error) {
    logger.error('GET /periods error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const { period, note } = body;

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Период должен быть в формате YYYY-MM' }, { status: 422 });
    }

    // Check if already closed and not reopened
    const existing = await db.periodClose.findUnique({ where: { period } });
    if (existing && !existing.isReopened) {
      return NextResponse.json({ error: 'Период уже закрыт' }, { status: 409 });
    }

    const closedPeriod = await db.periodClose.create({
      data: {
        period,
        closedBy: user.id,
        note: note || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(closedPeriod, { status: 201 });
  } catch (error) {
    logger.error('POST /periods error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to close period' }, { status: 500 });
  }
}
