import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import { checkPeriodClosed } from '@/lib/period-guard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        project: true,
        category: true,
        counterparty: true,
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('GET /transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: require owner, accountant, or manager (own only)
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

    const { id } = await params;
    const body = await request.json();

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Manager can only edit their own transactions
    if (user.role === 'manager' && existing.createdBy !== user.id) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    // Check if the transaction date falls in a closed period
    const dateToCheck = body.date ? new Date(body.date) : existing.date;
    const periodCheck = await checkPeriodClosed(dateToCheck);
    if (periodCheck.closed) {
      return NextResponse.json(
        { error: `Period is closed (${periodCheck.period}). ${periodCheck.note || ''}`.trim() },
        { status: 403 }
      );
    }

    // Validation
    if (body.amount !== undefined && body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 422 }
      );
    }

    if (body.type !== undefined && !['income', 'expense'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Type must be "income" or "expense"' },
        { status: 422 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'projectId',
      'categoryId',
      'counterpartyId',
      'date',
      'amount',
      'type',
      'description',
      'documentUrl',
      'source',
      'externalId',
      'requiresClassification',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'date' ? new Date(body[field]) : body[field];
      }
    }

    // Compare before/after for audit log
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const beforeValue = field === 'date' ? existing[field as keyof typeof existing]?.toISOString() : existing[field as keyof typeof existing];
        const afterValue = updateData[field];
        if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
          changes[field] = { before: beforeValue, after: afterValue };
        }
      }
    }

    const transaction = await db.transaction.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
        counterparty: { select: { id: true, name: true } },
      },
    });

    // Always create audit log with authenticated user
    await db.auditLog.create({
      data: {
        entityType: 'transaction',
        entityId: id,
        action: 'update',
        changes: JSON.stringify(Object.keys(changes).length > 0 ? changes : updateData),
        userId: user.id,
        transactionId: id,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('PUT /transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: require owner or accountant
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

    const { id } = await params;

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if the transaction date falls in a closed period
    const periodCheck = await checkPeriodClosed(existing.date);
    if (periodCheck.closed) {
      return NextResponse.json(
        { error: `Period is closed (${periodCheck.period}). ${periodCheck.note || ''}`.trim() },
        { status: 403 }
      );
    }

    await db.transaction.delete({ where: { id } });

    // Always create audit log with authenticated user
    await db.auditLog.create({
      data: {
        entityType: 'transaction',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({
          deletedAmount: existing.amount,
          deletedType: existing.type,
          deletedDate: existing.date,
          deletedDescription: existing.description,
          deletedCategoryId: existing.categoryId,
          deletedProjectId: existing.projectId,
        }),
        userId: user.id,
      },
    });

    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('DELETE /transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
