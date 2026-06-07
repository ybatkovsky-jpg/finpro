import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/budgets — List budgets with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const categoryId = searchParams.get('categoryId');
    const period = searchParams.get('period');

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (categoryId) where.categoryId = categoryId;
    if (period) where.period = period;

    const budgets = await db.budget.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ period: 'desc' }, { project: { name: 'asc' } }],
    });

    // Calculate actual spending for each budget
    const budgetsWithActual = await Promise.all(
      budgets.map(async (budget) => {
        const year = budget.period.substring(0, 4);
        const month = budget.period.substring(5, 7);

        let dateFilter: Record<string, unknown> = {};
        if (month) {
          // Monthly period
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
          dateFilter = {
            gte: startDate,
            lte: endDate,
          };
        } else {
          // Yearly period
          const startDate = new Date(parseInt(year), 0, 1);
          const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
          dateFilter = {
            gte: startDate,
            lte: endDate,
          };
        }

        const actuals = await db.transaction.aggregate({
          _sum: { amount: true },
          where: {
            projectId: budget.projectId,
            categoryId: budget.categoryId,
            date: dateFilter,
            type: budget.category.type,
          },
        });

        const actualAmount = actuals._sum.amount || 0;
        const variance = budget.amount - actualAmount;
        const utilization = budget.amount > 0 ? (actualAmount / budget.amount) * 100 : 0;

        return {
          ...budget,
          actualAmount,
          variance,
          utilization: Math.round(utilization * 10) / 10,
        };
      })
    );

    return NextResponse.json(budgetsWithActual);
  } catch (error) {
    console.error('GET /budgets error:', error);
    return NextResponse.json({ error: 'Ошибка получения бюджетов' }, { status: 500 });
  }
}

// POST /api/budgets — Create or update budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, categoryId, amount, period, note } = body;

    if (!projectId || !categoryId || !amount || !period) {
      return NextResponse.json(
        { error: 'Обязательные поля: projectId, categoryId, amount, period' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Сумма бюджета должна быть больше 0' },
        { status: 422 }
      );
    }

    // Validate period format (YYYY-MM or YYYY)
    if (!/^\d{4}(-\d{2})?$/.test(period)) {
      return NextResponse.json(
        { error: 'Формат периода: YYYY-MM или YYYY' },
        { status: 400 }
      );
    }

    // Upsert budget (unique constraint on projectId + categoryId + period)
    const budget = await db.budget.upsert({
      where: {
        projectId_categoryId_period: { projectId, categoryId, period },
      },
      create: {
        projectId,
        categoryId,
        amount,
        period,
        note,
      },
      update: {
        amount,
        note,
      },
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('POST /budgets error:', error);
    return NextResponse.json({ error: 'Ошибка создания бюджета' }, { status: 500 });
  }
}
