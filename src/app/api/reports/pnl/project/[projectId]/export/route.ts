import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { logger } from '@/lib/logger';

interface CogsLine {
  name: string;
  amount: number;
  children?: CogsLine[];
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
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

    const where: Record<string, unknown> = { projectId };
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

    // Calculate revenue
    const revenue = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Build COGS lines
    const expenseTransactions = transactions.filter((t) => t.type === 'expense');
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

    const totalCogs = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const grossProfit = revenue - totalCogs;
    const grossMargin = revenue > 0 ? grossProfit / revenue : 0;

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
      doc.font('DejaVuSans').fontSize(12).text('Отчёт P&L по проекту', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).text(`${project.name} (${project.externalId})`, { align: 'center' });
      doc.moveDown(0.2);
      doc.text(`Период: ${periodLabel}`, { align: 'center' });
      doc.moveDown(1);

      // Separator
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // Revenue
      doc.font('DejaVuSans-Bold').fontSize(11).text('Выручка', 50, doc.y, { continued: true });
      doc.text(formatNumberRu(revenue) + ' ₽', 50, doc.y, { align: 'right', width: pageWidth });
      doc.moveDown(0.5);

      // COGS header
      doc.font('DejaVuSans-Bold').fontSize(11).text('Себестоимость (разбивка):');
      doc.moveDown(0.3);

      // COGS table
      for (const line of cogsLines) {
        doc.font('DejaVuSans-Bold').fontSize(10);
        doc.text(`  ${line.name}`, 60, doc.y, { continued: true, width: pageWidth - 130 });
        doc.text(formatNumberRu(line.amount) + ' ₽', 60, doc.y, { align: 'right', width: pageWidth - 20 });

        if (line.children) {
          for (const child of line.children) {
            doc.font('DejaVuSans').fontSize(9);
            doc.text(`    ${child.name}`, 80, doc.y, { continued: true, width: pageWidth - 150 });
            doc.text(formatNumberRu(child.amount) + ' ₽', 80, doc.y, { align: 'right', width: pageWidth - 30 });
          }
        }
        doc.moveDown(0.2);
      }

      doc.moveDown(0.3);

      // Separator
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);

      // Totals
      doc.font('DejaVuSans-Bold').fontSize(11);
      doc.text('Итого себестоимость', 50, doc.y, { continued: true });
      doc.text(formatNumberRu(totalCogs) + ' ₽', 50, doc.y, { align: 'right', width: pageWidth });
      doc.moveDown(0.3);

      doc.text('Валовая прибыль', 50, doc.y, { continued: true });
      doc.text(formatNumberRu(grossProfit) + ' ₽', 50, doc.y, { align: 'right', width: pageWidth });
      doc.moveDown(0.3);

      doc.text('Валовая маржа', 50, doc.y, { continued: true });
      doc.text((grossMargin * 100).toFixed(1) + '%', 50, doc.y, { align: 'right', width: pageWidth });
      doc.moveDown(1);

      // Timestamp
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);
      doc.font('DejaVuSans').fontSize(8).text(`Сформирован: ${new Date().toLocaleString('ru-RU')}`, { align: 'right' });

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      const filename = `pnl_project_${project.externalId}.pdf`;
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // ===== CSV FORMAT =====
    if (format === 'csv') {
      const rows: string[][] = [
        ['Отчёт P&L по проекту'],
        [project.name, `(${project.externalId})`],
        [periodLabel],
        [],
        ['Статья', 'Сумма (₽)'],
        ['Выручка', revenue.toFixed(2)],
        [],
        ['Себестоимость (разбивка):', ''],
      ];

      for (const line of cogsLines) {
        rows.push([`  ${line.name}`, line.amount.toFixed(2)]);
        if (line.children) {
          for (const child of line.children) {
            rows.push([`    ${child.name}`, child.amount.toFixed(2)]);
          }
        }
      }

      rows.push(
        [],
        ['Итого себестоимость', totalCogs.toFixed(2)],
        ['Валовая прибыль', grossProfit.toFixed(2)],
        ['Валовая маржа', `${(grossMargin * 100).toFixed(1)}%`]
      );

      const csvContent = rows.map((r) => r.join(';')).join('\n');
      const filename = `pnl_project_${project.externalId}.csv`;

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // ===== EXCEL FORMAT (default) =====
    const wb = XLSX.utils.book_new();

    // Sheet 1: P&L Summary
    const summaryRows: (string | number)[][] = [
      ['Отчёт P&L по проекту'],
      ['Проект', project.name],
      ['Код проекта', project.externalId],
      [periodLabel],
      [],
      ['Статья', 'Сумма (₽)', 'Доля'],
      ['Выручка', revenue, '100%'],
      [],
      ['Себестоимость (разбивка):', '', ''],
    ];

    for (const line of cogsLines) {
      const share = totalCogs > 0 ? ((line.amount / totalCogs) * 100).toFixed(1) + '%' : '0%';
      summaryRows.push([line.name, line.amount, share]);
      if (line.children) {
        for (const child of line.children) {
          const childShare = totalCogs > 0 ? ((child.amount / totalCogs) * 100).toFixed(1) + '%' : '0%';
          summaryRows.push([`  ${child.name}`, child.amount, childShare]);
        }
      }
    }

    summaryRows.push(
      [],
      ['Итого себестоимость', totalCogs, '100%'],
      ['Валовая прибыль', grossProfit, revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) + '%' : '0%'],
      ['Валовая маржа', (grossMargin * 100).toFixed(1) + '%', '']
    );

    const ws = XLSX.utils.aoa_to_sheet(summaryRows);

    // Set column widths
    ws['!cols'] = [
      { wch: 35 },
      { wch: 18 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'P&L Сводка');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `pnl_project_${project.externalId}.xlsx`;

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('GET /reports/pnl/project/[projectId]/export error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to export P&L report' },
      { status: 500 }
    );
  }
}
