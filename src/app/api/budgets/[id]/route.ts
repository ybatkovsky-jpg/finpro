import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/budgets/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const budget = await db.budget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json({ error: 'Бюджет не найден' }, { status: 404 });
    }

    await db.budget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /budgets/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка удаления бюджета' }, { status: 500 });
  }
}

// PUT /api/budgets/[id] — Update budget
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const budget = await db.budget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json({ error: 'Бюджет не найден' }, { status: 404 });
    }

    const updated = await db.budget.update({
      where: { id },
      data: {
        amount: body.amount !== undefined ? body.amount : budget.amount,
        note: body.note !== undefined ? body.note : budget.note,
      },
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /budgets/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка обновления бюджета' }, { status: 500 });
  }
}
