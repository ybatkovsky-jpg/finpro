import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import bcrypt from 'bcryptjs';

// PUT /api/users/[id] — Update user (owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    requireRole(currentUser, 'owner');

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, role, isActive, password } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) {
      const validRoles = ['owner', 'accountant', 'manager', 'storekeeper'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Роль должна быть одной из: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'user',
        entityId: id,
        action: 'update',
        changes: JSON.stringify(updateData),
        userId: currentUser.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Доступ запрещён') {
      return NextResponse.json({ error: 'Только Собственник может редактировать пользователей' }, { status: 403 });
    }
    console.error('PUT /users/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка обновления пользователя' }, { status: 500 });
  }
}

// DELETE /api/users/[id] — Deactivate user (owner only, cannot delete self)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    requireRole(currentUser, 'owner');

    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'Нельзя деактивировать собственный аккаунт' },
        { status: 400 }
      );
    }

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Soft delete — deactivate instead of actual deletion
    const updated = await db.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'user',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({ action: 'deactivated' }),
        userId: currentUser.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'Доступ запрещён') {
      return NextResponse.json({ error: 'Только Собственник может деактивировать пользователей' }, { status: 403 });
    }
    console.error('DELETE /users/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка деактивации пользователя' }, { status: 500 });
  }
}
