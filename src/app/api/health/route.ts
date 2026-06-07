/**
 * Health Check API — GET /api/health
 * No auth required. Returns system health status.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus: 'ok' | 'error' = 'ok';

  // Check database connectivity
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.error('Health check: database connection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    dbStatus = 'error';
  }

  // Read version from package.json
  let version = 'unknown';
  try {
    const pkg = await import('../../../../package.json');
    version = pkg.version || 'unknown';
  } catch {
    // fallback
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  return NextResponse.json({
    status,
    timestamp,
    database: dbStatus,
    version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
  });
}
