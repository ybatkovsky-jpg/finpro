import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT /api/cashflow/[id] — Update cash flow payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const payment = await db.cashFlowPayment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 });
    }

    const updated = await db.cashFlowPayment.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        amount: body.amount ?? undefined,
        type: body.type ?? undefined,
        counterpartyId: body.counterpartyId !== undefined ? body.counterpartyId : undefined,
        projectId: body.projectId !== undefined ? body.projectId : undefined,
        description: body.description !== undefined ? body.description : undefined,
        status: body.status ?? undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate === null ? null : undefined,
      },
      include: {
        counterparty: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /cashflow/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка обновления платежа' }, { status: 500 });
  }
}

// DELETE /api/cashflow/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payment = await db.cashFlowPayment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 });
    }

    await db.cashFlowPayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /cashflow/[id] error:', error);
    return NextResponse.json({ error: 'Ошибка удаления платежа' }, { status: 500 });
  }
}
