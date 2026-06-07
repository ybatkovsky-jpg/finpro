import { db } from '@/lib/db';

/**
 * Check if a given date falls in a closed period.
 * Returns the closed period record if closed, or null if open.
 */
export async function getClosedPeriodForDate(date: Date): Promise<{
  id: string;
  period: string;
  closedBy: string;
  closedAt: Date;
  note: string | null;
} | null> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const periodKey = `${year}-${month}`;

  const closedPeriod = await db.periodClose.findUnique({
    where: { period: periodKey },
  });

  return closedPeriod;
}

/**
 * Check if a period is closed. Throws an error message if closed.
 * Returns null if open, or the closed period if closed.
 */
export async function checkPeriodClosed(date: Date): Promise<{
  closed: boolean;
  period?: string;
  note?: string | null;
}> {
  const closedPeriod = await getClosedPeriodForDate(date);
  if (closedPeriod) {
    return {
      closed: true,
      period: closedPeriod.period,
      note: closedPeriod.note,
    };
  }
  return { closed: false };
}
