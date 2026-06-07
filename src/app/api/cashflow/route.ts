import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/cashflow — List cash flow payments with filters and forecast
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const projectId = searchParams.get('projectId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (projectId) where.projectId = projectId;

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const payments = await db.cashFlowPayment.findMany({
      where,
      include: {
        counterparty: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate summary
    const confirmed = payments.filter(p => p.status === 'confirmed');
    const planned = payments.filter(p => p.status === 'planned');

    const inflowConfirmed = confirmed
      .filter(p => p.type === 'inflow')
      .reduce((sum, p) => sum + p.amount, 0);
    const outflowConfirmed = confirmed
      .filter(p => p.type === 'outflow')
      .reduce((sum, p) => sum + p.amount, 0);
    const inflowPlanned = planned
      .filter(p => p.type === 'planned_inflow')
      .reduce((sum, p) => sum + p.amount, 0);
    const outflowPlanned = planned
      .filter(p => p.type === 'planned_outflow')
      .reduce((sum, p) => sum + p.amount, 0);

    // Detect cash gaps — months where outflow > inflow
    const monthlyData = new Map<string, { inflow: number; outflow: number }>();
    for (const p of payments) {
      const monthKey = new Date(p.date).toISOString().substring(0, 7);
      const existing = monthlyData.get(monthKey) || { inflow: 0, outflow: 0 };

      if (p.type === 'inflow' || p.type === 'planned_inflow') {
        existing.inflow += p.amount;
      } else {
        existing.outflow += p.amount;
      }
      monthlyData.set(monthKey, existing);
    }

    const cashGaps = Array.from(monthlyData.entries())
      .filter(([, data]) => data.outflow > data.inflow)
      .map(([month, data]) => ({
        month,
        inflow: data.inflow,
        outflow: data.outflow,
        gap: data.outflow - data.inflow,
      }));

    return NextResponse.json({
      payments,
      summary: {
        inflowConfirmed,
        outflowConfirmed,
        inflowPlanned,
        outflowPlanned,
        netConfirmed: inflowConfirmed - outflowConfirmed,
        netForecast: (inflowConfirmed + inflowPlanned) - (outflowConfirmed + outflowPlanned),
      },
      cashGaps,
    });
  } catch (error) {
    console.error('GET /cashflow error:', error);
    return NextResponse.json({ error: 'Ошибка получения данных Cash Flow' }, { status: 500 });
  }
}

// POST /api/cashflow — Create cash flow payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, amount, type, counterpartyId, projectId, description, status, dueDate } = body;

    if (!date || !amount || !type) {
      return NextResponse.json(
        { error: 'Обязательные поля: date, amount, type' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Сумма должна быть больше 0' },
        { status: 422 }
      );
    }

    const validTypes = ['inflow', 'outflow', 'planned_inflow', 'planned_outflow'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Тип должен быть одним из: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const payment = await db.cashFlowPayment.create({
      data: {
        date: new Date(date),
        amount,
        type,
        counterpartyId: counterpartyId || null,
        projectId: projectId || null,
        description: description || null,
        status: status || 'planned',
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        counterparty: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('POST /cashflow error:', error);
    return NextResponse.json({ error: 'Ошибка создания платежа' }, { status: 500 });
  }
}
