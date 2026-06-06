import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await db.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, type: true } },
        _count: { select: { transactions: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('GET /categories/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
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
    const body = await request.json();

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'type', 'parentId'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || null;
      }
    }

    // Validate type if being changed
    if (body.type !== undefined && !['income', 'expense'].includes(body.type)) {
      return NextResponse.json(
        { error: 'type must be "income" or "expense"' },
        { status: 422 }
      );
    }

    // If parentId is being set, validate parent exists and type matches
    const effectiveType = (body.type as string) || existing.type;
    if (body.parentId !== undefined && body.parentId) {
      const parent = await db.category.findUnique({ where: { id: body.parentId } });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 422 }
        );
      }
      if (parent.type !== effectiveType) {
        return NextResponse.json(
          { error: 'Parent category type must match' },
          { status: 422 }
        );
      }
    }

    const category = await db.category.update({
      where: { id },
      data: updateData,
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, type: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'category',
        entityId: id,
        action: 'update',
        changes: JSON.stringify(updateData),
        userId: user.id,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('PUT /categories/[id] error:', error);
    if (String(error).includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: require owner only
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

    const { id } = await params;

    const existing = await db.category.findUnique({
      where: { id },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category has transactions
    if (existing._count.transactions > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить категорию с привязанными транзакциями' },
        { status: 409 }
      );
    }

    await db.category.delete({ where: { id } });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'category',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({
          name: existing.name,
          type: existing.type,
        }),
        userId: user.id,
      },
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('DELETE /categories/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
