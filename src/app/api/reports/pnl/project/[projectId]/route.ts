import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface CogsLine {
  name: string;
  amount: number;
  children?: CogsLine[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Verify project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, externalId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const where: Record<string, unknown> = {
      projectId,
    };
    if (dateFrom || dateTo) {
      where.date = dateFilter;
    }

    // Fetch all project transactions with categories
    const transactions = await db.transaction.findMany({
      where,
      include: {
        category: {
          include: {
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Calculate revenue (sum of income transactions)
    const revenue = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate COGS lines from expense transactions, grouped by category hierarchy
    const expenseTransactions = transactions.filter((t) => t.type === 'expense');

    // Build COGS lines with hierarchy support
    const cogsMap = new Map<string, { amount: number; children: Map<string, number> }>();

    for (const t of expenseTransactions) {
      const parentName = t.category.parent?.name || t.category.name;
      const childName = t.category.parent ? t.category.name : null;

      if (!cogsMap.has(parentName)) {
        cogsMap.set(parentName, { amount: 0, children: new Map<string, number>() });
      }

      const entry = cogsMap.get(parentName)!;
      entry.amount += t.amount;

      if (childName) {
        const childAmount = entry.children.get(childName) || 0;
        entry.children.set(childName, childAmount + t.amount);
      }
    }

    const cogsLines: CogsLine[] = Array.from(cogsMap.entries()).map(
      ([name, data]) => ({
        name,
        amount: Math.round(data.amount * 100) / 100,
        ...(data.children.size > 0
          ? {
              children: Array.from(data.children.entries()).map(
                ([childName, childAmount]) => ({
                  name: childName,
                  amount: Math.round(childAmount * 100) / 100,
                })
              ),
            }
          : {}),
      })
    );

    const totalCogs = expenseTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );
    const grossProfit = revenue - totalCogs;
    const grossMargin = revenue > 0 ? grossProfit / revenue : 0.0;

    const period = {
      from: dateFrom || null,
      to: dateTo || null,
    };

    return NextResponse.json({
      projectName: project.name,
      period,
      revenue: Math.round(revenue * 100) / 100,
      cogsLines,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMargin: Math.round(grossMargin * 10000) / 10000,
    });
  } catch (error) {
    console.error('GET /reports/pnl/project error:', error);
    return NextResponse.json(
      { error: 'Failed to generate P&L report' },
      { status: 500 }
    );
  }
}
