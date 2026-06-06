import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    console.error('GET /transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      categoryId,
      counterpartyId,
      createdBy,
      date,
      amount,
      type,
      description,
      documentUrl,
      source = 'manual',
      externalId,
      requiresClassification = false,
    } = body;

    // Validation
    if (!amount || amount <= 0) {
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

    if (!createdBy) {
      return NextResponse.json(
        { error: 'createdBy is required' },
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDate = transactionDate > today;

    const transaction = await db.transaction.create({
      data: {
        projectId: projectId || null,
        categoryId,
        counterpartyId: counterpartyId || null,
        createdBy,
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
        userId: createdBy,
        transactionId: transaction.id,
      },
    });

    const response = NextResponse.json(transaction, { status: 201 });

    if (isFutureDate) {
      response.headers.set('X-Warning', 'future_date');
    }

    return response;
  } catch (error) {
    console.error('POST /transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
