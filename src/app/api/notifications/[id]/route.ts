import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/notifications/[id] — Mark single notification as read
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notification = await db.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json({ error: 'Уведомление не найдено' }, { status: 404 });
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /notifications/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка обновления уведомления' }, { status: 500 });
  }
}

// DELETE /api/notifications/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notification = await db.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json({ error: 'Уведомление не найдено' }, { status: 404 });
    }

    await db.notification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /notifications/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка удаления уведомления' }, { status: 500 });
  }
}
