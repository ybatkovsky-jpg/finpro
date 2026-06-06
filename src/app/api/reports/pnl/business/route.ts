import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const baseWhere: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      baseWhere.date = dateFilter;
    }

    // Fetch all transactions in the period
    const allTransactions = await db.transaction.findMany({
      where: baseWhere,
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
      },
    });

    // Calculate total revenue and COGS
    const revenue = allTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const cogs = allTransactions
      .filter((t) => t.type === 'expense' && t.projectId !== null)
      .reduce((sum, t) => sum + t.amount, 0);

    const grossProfit = revenue - cogs;

    // Operational expenses = expense transactions without a project
    const operationalExpenses = allTransactions
      .filter((t) => t.type === 'expense' && t.projectId === null)
      .reduce((sum, t) => sum + t.amount, 0);

    // EBIT = Gross Profit - Operational Expenses
    const ebit = grossProfit - operationalExpenses;

    // USN Tax (Simplified tax system, 15% on profit when positive)
    const taxBase = ebit;
    const usnTax = taxBase > 0 ? Math.round(taxBase * 0.15 * 100) / 100 : 0;

    // Net Profit
    const netProfit = ebit - usnTax;

    // Project breakdown
    const projectMap = new Map<
      string,
      {
        projectName: string;
        revenue: number;
        cogs: number;
        grossProfit: number;
      }
    >();

    for (const t of allTransactions) {
      if (!t.projectId || !t.project) continue;

      const projectId = t.projectId;
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectName: t.project.name,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
        });
      }

      const entry = projectMap.get(projectId)!;
      if (t.type === 'income') {
        entry.revenue += t.amount;
      } else {
        entry.cogs += t.amount;
      }
    }

    // Calculate gross profit for each project
    const projectBreakdown = Array.from(projectMap.values()).map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      cogs: Math.round(p.cogs * 100) / 100,
      grossProfit: Math.round((p.revenue - p.cogs) * 100) / 100,
    }));

    const period = {
      from: dateFrom || null,
      to: dateTo || null,
    };

    return NextResponse.json({
      period,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      operationalExpenses: Math.round(operationalExpenses * 100) / 100,
      ebit: Math.round(ebit * 100) / 100,
      usnTax,
      netProfit: Math.round(netProfit * 100) / 100,
      projectBreakdown,
    });
  } catch (error) {
    console.error('GET /reports/pnl/business error:', error);
    return NextResponse.json(
      { error: 'Failed to generate business P&L report' },
      { status: 500 }
    );
  }
}
