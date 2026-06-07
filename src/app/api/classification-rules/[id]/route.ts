import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    const existing = await db.classificationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['keyword', 'categoryId', 'counterpartyKeyword', 'projectId', 'priority', 'isActive'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const rule = await db.classificationRule.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true, externalId: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'classification_rule',
        entityId: id,
        action: 'update',
        changes: JSON.stringify(updateData),
        userId: user.id,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('PUT /api/classification-rules/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update classification rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existing = await db.classificationRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await db.classificationRule.delete({ where: { id } });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'classification_rule',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({ deletedKeyword: existing.keyword, deletedCategoryId: existing.categoryId }),
        userId: user.id,
      },
    });

    return NextResponse.json({ message: 'Classification rule deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/classification-rules/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete classification rule' },
      { status: 500 }
    );
  }
}
