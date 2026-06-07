import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

// GET /api/audit — List audit logs (owner/accountant only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    // Only owner and accountant can view audit logs
    if (user.role !== 'owner' && user.role !== 'accountant') {
      return NextResponse.json(
        { error: 'Доступ запрещён. Требуется роль Собственник или Бухгалтер.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.createdAt = dateFilter;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (error) {
    console.error('GET /audit error:', error);
    return NextResponse.json({ error: 'Ошибка получения журнала аудита' }, { status: 500 });
  }
}
