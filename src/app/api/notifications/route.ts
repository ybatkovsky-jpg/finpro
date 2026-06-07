import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser } from '@/lib/auth-guard';

// GET /api/notifications — List current user's notifications
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

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { userId: user.id };
    if (unreadOnly) where.isRead = false;

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await db.notification.count({
      where: { userId: user.id, isRead: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('GET /notifications error:', error);
    return NextResponse.json({ error: 'Ошибка получения уведомлений' }, { status: 500 });
  }
}

// POST /api/notifications — Create notification (internal use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, title, message, link } = body;

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Обязательные поля: userId, type, title, message' },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('POST /notifications error:', error);
    return NextResponse.json({ error: 'Ошибка создания уведомления' }, { status: 500 });
  }
}

// PUT /api/notifications — Mark all as read
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }

    const result = await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('PUT /notifications error:', error);
    return NextResponse.json({ error: 'Ошибка обновления уведомлений' }, { status: 500 });
  }
}
