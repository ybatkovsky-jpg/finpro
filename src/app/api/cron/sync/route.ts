/**
 * Cron API — POST /api/cron/sync
 * Triggers ZakupPro sync, protected by X-API-Key auth.
 * For external cron services (Timeweb cron, cron-job.org).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey } from '@/lib/api-key-auth';
import { logger } from '@/lib/logger';
import {
  fetchZakupProProjects,
  mapZakupProStatus,
  type ZakupProSyncResult,
} from '@/lib/zakuppro';

export async function POST(request: NextRequest) {
  try {
    // Auth: X-API-Key required
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Требуется X-API-Key для доступа к cron-эндпоинтам' },
        { status: 401 }
      );
    }

    logger.info('Cron sync: ZakupPro auto-sync triggered');

    // Create sync log
    const syncLog = await db.syncLog.create({
      data: {
        source: 'zakuppro',
        status: 'success',
        recordsTotal: 0,
        recordsSynced: 0,
      },
    });

    const result: ZakupProSyncResult = {
      fetched: 0,
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Fetch real projects from ZakupPro API
      const zakupProProjects = await fetchZakupProProjects();
      result.fetched = zakupProProjects.length;

      // Update sync log with total
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: { recordsTotal: zakupProProjects.length },
      });

      for (const zpProject of zakupProProjects) {
        try {
          const externalId = zpProject.number || String(zpProject.id);
          const existing = await db.project.findUnique({
            where: { externalId },
          });

          const projectStatus = mapZakupProStatus(zpProject.status);

          if (existing) {
            const needsUpdate =
              existing.name !== zpProject.name ||
              existing.contractAmount !== zpProject.contract_amount ||
              existing.status !== projectStatus;

            if (needsUpdate) {
              await db.project.update({
                where: { id: existing.id },
                data: {
                  name: zpProject.name,
                  contractAmount: zpProject.contract_amount,
                  status: projectStatus,
                  startDate: zpProject.start_date ? new Date(zpProject.start_date) : existing.startDate,
                  endDate: zpProject.end_date ? new Date(zpProject.end_date) : existing.endDate,
                },
              });
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await db.project.create({
              data: {
                externalId,
                name: zpProject.name,
                contractAmount: zpProject.contract_amount,
                status: projectStatus,
                startDate: zpProject.start_date ? new Date(zpProject.start_date) : null,
                endDate: zpProject.end_date ? new Date(zpProject.end_date) : null,
              },
            });
            result.created++;
          }

          result.synced++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error('Cron sync: error syncing project', {
            externalId: zpProject.number || String(zpProject.id),
            error: errMsg,
          });
          result.errors.push({
            externalId: zpProject.number || String(zpProject.id),
            error: errMsg,
          });
        }
      }

      // Update sync log completion
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: result.errors.length > 0 ? 'partial' : 'success',
          recordsSynced: result.synced,
          errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
          completedAt: new Date(),
        },
      });
    } catch (apiError) {
      const errMsg = apiError instanceof Error ? apiError.message : 'API fetch failed';
      logger.error('Cron sync: API fetch failed', { error: errMsg });

      await db.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errors: JSON.stringify([{ error: errMsg }]),
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: errMsg, syncedAt: new Date().toISOString() },
        { status: 500 }
      );
    }

    logger.info('Cron sync: ZakupPro auto-sync completed', {
      fetched: result.fetched,
      synced: result.synced,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return NextResponse.json({
      ...result,
      syncedAt: new Date().toISOString(),
      triggeredBy: 'cron',
    });
  } catch (error) {
    logger.error('Cron sync: unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Ошибка синхронизации' },
      { status: 500 }
    );
  }
}
