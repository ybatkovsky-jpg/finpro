import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import { checkPeriodClosed } from '@/lib/period-guard';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');
    const categoryId = searchParams.get('categoryId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const source = searchParams.get('source');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (source) where.source = source;

    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          project: { select: { id: true, name: true, externalId: true } },
          category: { select: { id: true, name: true, type: true } },
          counterparty: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      db.transaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('GET /transactions error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // RBAC: require owner, accountant, or manager
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }
    try {
      requireRole(user, 'owner', 'accountant', 'manager');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const body = await request.json();
    const {
      projectId,
      categoryId,
      counterpartyId,
      date,
      amount,
      type,
      description,
      documentUrl,
      source = 'manual',
      externalId,
      requiresClassification = false,
    } = body;

    // Validation: amount must be a positive number (0 or negative → 422 Unprocessable Entity)
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 422 }
      );
    }

    if (!type || !['income', 'expense'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "income" or "expense"' },
        { status: 422 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 422 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 422 }
      );
    }

    const transactionDate = new Date(date);

    // Check if the transaction date falls in a closed period
    const periodCheck = await checkPeriodClosed(transactionDate);
    if (periodCheck.closed) {
      return NextResponse.json(
        { error: `Period is closed (${periodCheck.period}). ${periodCheck.note || ''}`.trim() },
        { status: 403 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDate = transactionDate > today;

    const transaction = await db.transaction.create({
      data: {
        projectId: projectId || null,
        categoryId,
        counterpartyId: counterpartyId || null,
        createdBy: user.id,
        date: transactionDate,
        amount,
        type,
        description: description || null,
        documentUrl: documentUrl || null,
        source,
        externalId: externalId || null,
        requiresClassification,
      },
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
        counterparty: { select: { id: true, name: true } },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        entityType: 'transaction',
        entityId: transaction.id,
        action: 'create',
        changes: JSON.stringify({ amount, type, date, categoryId, projectId }),
        userId: user.id,
        transactionId: transaction.id,
      },
    });

    const response = NextResponse.json(transaction, { status: 201 });

    if (isFutureDate) {
      response.headers.set('X-Warning', 'future_date');
    }

    return response;
  } catch (error) {
    logger.error('POST /transactions error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
