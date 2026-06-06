import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const { id } = await params;
    const body = await request.json();
    const userId = body.userId || body.createdBy;

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
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

    const transaction = await db.transaction.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
        counterparty: { select: { id: true, name: true } },
      },
    });

    // Create audit log
    if (userId) {
      await db.auditLog.create({
        data: {
          entityType: 'transaction',
          entityId: id,
          action: 'update',
          changes: JSON.stringify(updateData),
          userId,
          transactionId: id,
        },
      });
    }

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    await db.transaction.delete({ where: { id } });

    // Create audit log
    if (userId) {
      await db.auditLog.create({
        data: {
          entityType: 'transaction',
          entityId: id,
          action: 'delete',
          changes: JSON.stringify({
            deletedAmount: existing.amount,
            deletedType: existing.type,
            deletedDate: existing.date,
          }),
          userId,
        },
      });
    }

    return NextResponse.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('DELETE /transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
