import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import bcrypt from 'bcryptjs';

// GET /api/users — List users (owner only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user || user.role !== 'owner') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('GET /users error:', error);
    return NextResponse.json({ error: 'Ошибка получения пользователей' }, { status: 500 });
  }
}

// POST /api/users — Create user (owner only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    requireRole(currentUser, 'owner');

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Обязательные поля: name, email, password, role' },
        { status: 400 }
      );
    }

    const validRoles = ['owner', 'accountant', 'manager', 'storekeeper'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Роль должна быть одной из: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'user',
        entityId: newUser.id,
        action: 'create',
        changes: JSON.stringify({ name, email, role }),
        userId: currentUser.id,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Доступ запрещён') {
      return NextResponse.json({ error: 'Только Собственник может создавать пользователей' }, { status: 403 });
    }
    console.error('POST /users error:', error);
    return NextResponse.json({ error: 'Ошибка создания пользователя' }, { status: 500 });
  }
}
