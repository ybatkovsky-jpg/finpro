import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { logger } from '@/lib/logger';

/**
 * Format number with Russian thousands separator (space)
 */
function formatNumberRu(num: number): string {
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Register Cyrillic-capable font for pdfkit
 */
function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
  doc.registerFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const format = searchParams.get('format') || 'excel';

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

    const periodLabel = `${dateFrom || '—'} — ${dateTo || '—'}`;

    // ===== PDF FORMAT =====
    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      const pageWidth = doc.page.width - 100; // margins

      // Header
      doc.font('DejaVuSans-Bold').fontSize(16).text('ООО ПРО Мебель', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('DejaVuSans').fontSize(12).text('Отчёт P&L по бизнесу', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).text(`Период: ${periodLabel}`, { align: 'center' });
      doc.moveDown(1);

      // Separator
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // P&L Summary Table
      const pnlItems = [
        { label: 'Выручка', value: revenue, share: '100%' },
        { label: 'Себестоимость (COGS)', value: -cogs, share: revenue > 0 ? `${((-cogs / revenue) * 100).toFixed(1)}%` : '0%' },
        { label: 'Валовая прибыль', value: grossProfit, share: revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}%` : '0%' },
        { label: 'Операционные расходы', value: -operationalExpenses, share: revenue > 0 ? `${((-operationalExpenses / revenue) * 100).toFixed(1)}%` : '0%' },
        { label: 'EBIT', value: ebit, share: revenue > 0 ? `${((ebit / revenue) * 100).toFixed(1)}%` : '0%' },
        { label: 'УСН налог (15%)', value: -usnTax, share: revenue > 0 ? `${((-usnTax / revenue) * 100).toFixed(1)}%` : '0%' },
        { label: 'Чистая прибыль', value: netProfit, share: revenue > 0 ? `${((netProfit / revenue) * 100).toFixed(1)}%` : '0%' },
      ];

      // Table header
      doc.font('DejaVuSans-Bold').fontSize(10);
      doc.text('Статья', 50, doc.y, { continued: true, width: pageWidth * 0.5 });
      doc.text('Сумма (₽)', 50 + pageWidth * 0.5, doc.y, { continued: true, width: pageWidth * 0.3, align: 'right' });
      doc.text('Доля', 50 + pageWidth * 0.8, doc.y, { width: pageWidth * 0.2, align: 'right' });
      doc.moveDown(0.3);

      // Separator
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.3);

      for (const item of pnlItems) {
        const isBold = item.label === 'Валовая прибыль' || item.label === 'Чистая прибыль' || item.label === 'EBIT';
        doc.font(isBold ? 'DejaVuSans-Bold' : 'DejaVuSans').fontSize(9);
        doc.text(item.label, 50, doc.y, { continued: true, width: pageWidth * 0.5 });
        doc.text(formatNumberRu(item.value), 50 + pageWidth * 0.5, doc.y, { continued: true, width: pageWidth * 0.3, align: 'right' });
        doc.text(item.share, 50 + pageWidth * 0.8, doc.y, { width: pageWidth * 0.2, align: 'right' });
        doc.moveDown(0.2);
      }

      doc.moveDown(1);

      // Separator
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // Project breakdown table
      doc.font('DejaVuSans-Bold').fontSize(11).text('Разбивка по проектам');
      doc.moveDown(0.5);

      // Table header
      const colWidths = [0.12, 0.25, 0.18, 0.18, 0.18, 0.09];
      const colLabels = ['Код', 'Проект', 'Выручка', 'Себестоимость', 'Прибыль', 'Маржа'];
      const colX = [50];
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX.push(colX[i] + pageWidth * colWidths[i]);
      }

      doc.font('DejaVuSans-Bold').fontSize(8);
      let y = doc.y;
      for (let i = 0; i < colLabels.length; i++) {
        doc.text(colLabels[i], colX[i], y, { width: pageWidth * colWidths[i], align: i < 2 ? 'left' : 'right' });
      }
      doc.moveDown(0.3);

      // Separator
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.3);

      for (const p of projectBreakdown) {
        const margin = p.revenue > 0 ? ((p.grossProfit / p.revenue) * 100).toFixed(1) + '%' : '0.0%';
        y = doc.y;
        doc.font('DejaVuSans').fontSize(7);
        doc.text(p.projectCode, colX[0], y, { width: pageWidth * colWidths[0] });
        doc.text(p.projectName, colX[1], y, { width: pageWidth * colWidths[1] });
        doc.text(formatNumberRu(p.revenue), colX[2], y, { width: pageWidth * colWidths[2], align: 'right' });
        doc.text(formatNumberRu(-p.cogs), colX[3], y, { width: pageWidth * colWidths[3], align: 'right' });
        doc.text(formatNumberRu(p.grossProfit), colX[4], y, { width: pageWidth * colWidths[4], align: 'right' });
        doc.text(margin, colX[5], y, { width: pageWidth * colWidths[5], align: 'right' });
        doc.moveDown(0.2);
      }

      // Totals row
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.3);

      const totalRevenue = projectBreakdown.reduce((s, p) => s + p.revenue, 0);
      const totalCogs = projectBreakdown.reduce((s, p) => s + p.cogs, 0);
      const totalGrossProfit = projectBreakdown.reduce((s, p) => s + p.grossProfit, 0);
      const totalMargin = revenue > 0 ? ((totalGrossProfit / revenue) * 100).toFixed(1) + '%' : '0.0%';

      y = doc.y;
      doc.font('DejaVuSans-Bold').fontSize(8);
      doc.text('ИТОГО', colX[1], y, { width: pageWidth * colWidths[1] });
      doc.text(formatNumberRu(totalRevenue), colX[2], y, { width: pageWidth * colWidths[2], align: 'right' });
      doc.text(formatNumberRu(-totalCogs), colX[3], y, { width: pageWidth * colWidths[3], align: 'right' });
      doc.text(formatNumberRu(totalGrossProfit), colX[4], y, { width: pageWidth * colWidths[4], align: 'right' });
      doc.text(totalMargin, colX[5], y, { width: pageWidth * colWidths[5], align: 'right' });

      doc.moveDown(2);

      // Timestamp
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('DejaVuSans').fontSize(8).text(`Сформирован: ${new Date().toLocaleString('ru-RU')}`, { align: 'right' });

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      const filename = `pnl_business_${new Date().toISOString().slice(0, 10)}.pdf`;
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // ===== EXCEL FORMAT (default) =====
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
    logger.error('GET /reports/pnl/business/export error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to export business P&L report' },
      { status: 500 }
    );
  }
}
