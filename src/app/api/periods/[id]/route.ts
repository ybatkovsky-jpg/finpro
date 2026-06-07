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
    // Only owner can reopen
    try {
      requireRole(user, 'owner');
    } catch {
      return NextResponse.json({ error: 'Только владелец может переоткрыть период' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { note } = body;

    const existing = await db.periodClose.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Период не найден' }, { status: 404 });
    }

    const reopened = await db.periodClose.update({
      where: { id },
      data: {
        isReopened: true,
        note: note || existing.note,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(reopened);
  } catch (error) {
    console.error('PUT /periods/[id] error:', error);
    return NextResponse.json({ error: 'Failed to reopen period' }, { status: 500 });
  }
}
