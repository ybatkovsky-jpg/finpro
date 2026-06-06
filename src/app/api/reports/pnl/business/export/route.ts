import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

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

    // Calculate totals
    const revenue = allTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const cogs = allTransactions
      .filter((t) => t.type === 'expense' && t.projectId !== null)
      .reduce((sum, t) => sum + t.amount, 0);

    const grossProfit = revenue - cogs;

    const operationalExpenses = allTransactions
      .filter((t) => t.type === 'expense' && t.projectId === null)
      .reduce((sum, t) => sum + t.amount, 0);

    const ebit = grossProfit - operationalExpenses;
    const usnTax = ebit > 0 ? Math.round(ebit * 0.15 * 100) / 100 : 0;
    const netProfit = ebit - usnTax;

    // Project breakdown
    const projectMap = new Map<
      string,
      { projectName: string; projectCode: string; revenue: number; cogs: number; grossProfit: number }
    >();

    for (const t of allTransactions) {
      if (!t.projectId || !t.project) continue;

      if (!projectMap.has(t.projectId)) {
        projectMap.set(t.projectId, {
          projectName: t.project.name,
          projectCode: t.project.externalId,
          revenue: 0,
          cogs: 0,
          grossProfit: 0,
        });
      }

      const entry = projectMap.get(t.projectId)!;
      if (t.type === 'income') {
        entry.revenue += t.amount;
      } else {
        entry.cogs += t.amount;
      }
    }

    const projectBreakdown = Array.from(projectMap.values()).map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      cogs: Math.round(p.cogs * 100) / 100,
      grossProfit: Math.round((p.revenue - p.cogs) * 100) / 100,
    }));

    const periodLabel = `Период: ${dateFrom || '—'} — ${dateTo || '—'}`;

    // Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: P&L Summary
    const pnlRows: (string | number)[][] = [
      ['Отчёт P&L по бизнесу'],
      [periodLabel],
      [],
      ['Статья', 'Сумма (₽)', 'Доля от выручки'],
      ['Выручка', revenue, '100%'],
      ['Себестоимость (COGS)', -cogs, revenue > 0 ? `${((-cogs / revenue) * 100).toFixed(1)}%` : '0%'],
      ['Валовая прибыль', grossProfit, revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}%` : '0%'],
      ['Операционные расходы', -operationalExpenses, revenue > 0 ? `${((-operationalExpenses / revenue) * 100).toFixed(1)}%` : '0%'],
      ['EBIT', ebit, revenue > 0 ? `${((ebit / revenue) * 100).toFixed(1)}%` : '0%'],
      ['УСН налог (15%)', -usnTax, revenue > 0 ? `${((-usnTax / revenue) * 100).toFixed(1)}%` : '0%'],
      ['Чистая прибыль', netProfit, revenue > 0 ? `${((netProfit / revenue) * 100).toFixed(1)}%` : '0%'],
    ];

    const wsPnl = XLSX.utils.aoa_to_sheet(pnlRows);
    wsPnl['!cols'] = [
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPnl, 'P&L Сводка');

    // Sheet 2: Project breakdown
    const breakdownRows: (string | number)[][] = [
      ['Разбивка по проектам'],
      [periodLabel],
      [],
      ['Код проекта', 'Проект', 'Выручка (₽)', 'Себестоимость (₽)', 'Валовая прибыль (₽)', 'Маржа (%)'],
    ];

    for (const p of projectBreakdown) {
      const margin = p.revenue > 0 ? ((p.grossProfit / p.revenue) * 100).toFixed(1) : '0.0';
      breakdownRows.push([p.projectCode, p.projectName, p.revenue, -p.cogs, p.grossProfit, Number(margin)]);
    }

    // Totals row
    breakdownRows.push([
      '',
      'ИТОГО',
      projectBreakdown.reduce((s, p) => s + p.revenue, 0),
      -projectBreakdown.reduce((s, p) => s + p.cogs, 0),
      projectBreakdown.reduce((s, p) => s + p.grossProfit, 0),
      revenue > 0
        ? Number(((projectBreakdown.reduce((s, p) => s + p.grossProfit, 0) / revenue) * 100).toFixed(1))
        : 0,
    ]);

    const wsBreakdown = XLSX.utils.aoa_to_sheet(breakdownRows);
    wsBreakdown['!cols'] = [
      { wch: 16 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Разбивка по проектам');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `pnl_business_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /reports/pnl/business/export error:', error);
    return NextResponse.json(
      { error: 'Failed to export business P&L report' },
      { status: 500 }
    );
  }
}
