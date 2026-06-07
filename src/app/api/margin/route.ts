import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // on_target | at_risk | below_target

    // Get all active projects with their transactions
    const projects = await db.project.findMany({
      where: { status: { in: ['active', 'lead'] } },
      include: {
        transactions: {
          select: { amount: true, type: true, date: true },
        },
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    const projectMargins = projects.map((project) => {
      const revenue = project.transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = project.transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const profit = revenue - expenses;
      const currentMargin = revenue > 0 ? profit / revenue : 0;
      const marginTarget = project.marginTarget ?? 0.25;

      // Determine margin status
      let marginStatus: 'on_target' | 'at_risk' | 'below_target';
      if (currentMargin >= marginTarget) {
        marginStatus = 'on_target';
      } else if (currentMargin >= marginTarget * 0.7) {
        marginStatus = 'at_risk';
      } else {
        marginStatus = 'below_target';
      }

      // Forecast: calculate monthly burn rate and estimate final margin
      let forecast: {
        monthlyBurnRate: number;
        monthsElapsed: number;
        estimatedTotalCost: number;
        estimatedFinalMargin: number;
      } | null = null;

      if (project.startDate && project.contractAmount) {
        const start = new Date(project.startDate);
        const monthsElapsed = Math.max(
          1,
          (now.getFullYear() - start.getFullYear()) * 12 +
            (now.getMonth() - start.getMonth())
        );
        const monthlyBurnRate = expenses / monthsElapsed;

        // Estimate remaining months based on contract amount and revenue so far
        const remainingRevenue = Math.max(0, project.contractAmount - revenue);
        // If revenue rate is positive, estimate remaining months
        const monthlyRevenueRate = revenue / monthsElapsed;
        const estimatedRemainingMonths =
          monthlyRevenueRate > 0
            ? Math.ceil(remainingRevenue / monthlyRevenueRate)
            : monthsElapsed;

        const estimatedTotalCost = expenses + monthlyBurnRate * estimatedRemainingMonths;
        const estimatedFinalRevenue = project.contractAmount;
        const estimatedFinalMargin =
          estimatedFinalRevenue > 0
            ? (estimatedFinalRevenue - estimatedTotalCost) / estimatedFinalRevenue
            : 0;

        forecast = {
          monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
          monthsElapsed,
          estimatedTotalCost: Math.round(estimatedTotalCost * 100) / 100,
          estimatedFinalMargin:
            Math.round(estimatedFinalMargin * 10000) / 10000,
        };
      }

      // Update deadlineStatus based on dates
      let deadlineStatus = project.deadlineStatus || 'on_track';
      if (project.endDate) {
        const end = new Date(project.endDate);
        const daysUntilDeadline = Math.ceil(
          (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilDeadline < 0) {
          deadlineStatus = 'overdue';
        } else if (daysUntilDeadline < 14) {
          deadlineStatus = 'at_risk';
        } else {
          deadlineStatus = 'on_track';
        }
      }

      return {
        id: project.id,
        externalId: project.externalId,
        name: project.name,
        client: project.client,
        manager: project.manager,
        status: project.status,
        contractAmount: project.contractAmount,
        startDate: project.startDate,
        endDate: project.endDate,
        marginTarget,
        completedAt: project.completedAt,
        qualityRating: project.qualityRating,
        deadlineStatus,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        currentMargin: Math.round(currentMargin * 10000) / 10000,
        marginStatus,
        forecast,
      };
    });

    // Apply filter if provided
    const filtered = statusFilter
      ? projectMargins.filter((p) => p.marginStatus === statusFilter)
      : projectMargins;

    // Summary stats
    const summary = {
      total: projectMargins.length,
      on_target: projectMargins.filter((p) => p.marginStatus === 'on_target').length,
      at_risk: projectMargins.filter((p) => p.marginStatus === 'at_risk').length,
      below_target: projectMargins.filter((p) => p.marginStatus === 'below_target').length,
    };

    // Margin alerts for projects below target
    const alerts = projectMargins
      .filter((p) => p.marginStatus === 'below_target' || p.marginStatus === 'at_risk')
      .map((p) => ({
        projectId: p.id,
        projectName: p.name,
        externalId: p.externalId,
        marginStatus: p.marginStatus,
        currentMargin: p.currentMargin,
        marginTarget: p.marginTarget,
        gap: Math.round((p.marginTarget - p.currentMargin) * 10000) / 10000,
        message:
          p.marginStatus === 'below_target'
            ? `Маржа проекта "${p.name}" (${(p.currentMargin * 100).toFixed(1)}%) значительно ниже целевой (${(p.marginTarget * 100).toFixed(1)}%)`
            : `Маржа проекта "${p.name}" (${(p.currentMargin * 100).toFixed(1)}%) близка к критическому уровню (целевая: ${(p.marginTarget * 100).toFixed(1)}%)`,
      }));

    return NextResponse.json({
      projects: filtered,
      summary,
      alerts,
    });
  } catch (error) {
    console.error('GET /api/margin error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch margin data' },
      { status: 500 }
    );
  }
}
