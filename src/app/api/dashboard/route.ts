import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    // Calculate current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Total revenue this month
    const revenueResult = await db.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'income',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    // Total expenses this month
    const expenseResult = await db.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'expense',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    // Number of active projects
    const activeProjectsCount = await db.project.count({
      where: { status: 'active' },
    });

    // Recent transactions (last 10)
    const recentTransactions = await db.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true, externalId: true } },
        category: { select: { id: true, name: true, type: true } },
        counterparty: { select: { id: true, name: true } },
      },
    });

    // Pending classification count
    const pendingClassificationCount = await db.transaction.count({
      where: { requiresClassification: true },
    });

    // Project profitability ranking (top 5)
    const projects = await db.project.findMany({
      where: { status: 'active' },
      include: {
        transactions: {
          select: { amount: true, type: true },
        },
      },
    });

    const projectProfitability = projects
      .map((project) => {
        const revenue = project.transactions
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        const expenses = project.transactions
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        const profit = revenue - expenses;
        const margin = revenue > 0 ? profit / revenue : 0;

        return {
          id: project.id,
          name: project.name,
          externalId: project.externalId,
          revenue: Math.round(revenue * 100) / 100,
          expenses: Math.round(expenses * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          margin: Math.round(margin * 10000) / 10000,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Margin summary data
    const marginTarget = 0.25;
    const marginSummary = {
      total: projects.length,
      on_target: 0,
      at_risk: 0,
      below_target: 0,
    };

    for (const project of projects) {
      const revenue = project.transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = project.transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const currentMargin = revenue > 0 ? (revenue - expenses) / revenue : 0;
      const target = project.marginTarget ?? marginTarget;

      if (currentMargin >= target) {
        marginSummary.on_target++;
      } else if (currentMargin >= target * 0.7) {
        marginSummary.at_risk++;
      } else {
        marginSummary.below_target++;
      }
    }

    const totalRevenue = revenueResult._sum.amount || 0;
    const totalExpenses = expenseResult._sum.amount || 0;

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netIncome: Math.round((totalRevenue - totalExpenses) * 100) / 100,
      activeProjectsCount,
      recentTransactions,
      pendingClassificationCount,
      projectProfitability,
      marginSummary,
    });
  } catch (error) {
    console.error('GET /dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
