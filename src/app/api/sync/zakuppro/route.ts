import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey, apiKeyOrSession } from '@/lib/api-key-auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import {
  fetchZakupProProjects,
  mapZakupProStatus,
  validateZakupProConnection,
  type ZakupProSyncResult,
} from '@/lib/zakuppro';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Authentication: accept EITHER X-API-Key header OR authenticated session (owner only)
    const isApiKey = validateApiKey(request);
    const session = await getServerSession(authOptions);
    let isSession = false;
    let sessionUser = null;

    if (session?.user) {
      const user = await getCurrentUser();
      if (user) {
        try {
          requireRole(user, 'owner');
          isSession = true;
          sessionUser = user;
        } catch {
          // User is authenticated but not owner — not authorized for this endpoint
        }
      }
    }

    // Also allow accountant role
    if (!isSession && session?.user) {
      const user = await getCurrentUser();
      if (user && (user.role === 'owner' || user.role === 'accountant')) {
        isSession = true;
        sessionUser = user;
      }
    }

    const authResult = { authenticated: isApiKey || isSession, isApiKey };
    if (!apiKeyOrSession(authResult)) {
      return NextResponse.json(
        { error: 'Требуется авторизация. Используйте X-API-Key или авторизованную сессию с ролью owner/accountant.' },
        { status: 401 }
      );
    }

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
            // Update if name, amount, or status changed
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
            // Create new project
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
          logger.error('Error syncing project', { externalId: zpProject.number, error: err instanceof Error ? err.message : 'Unknown error' });
          result.errors.push({
            externalId: zpProject.number || String(zpProject.id),
            error: err instanceof Error ? err.message : 'Unknown error',
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
      // API fetch failed entirely
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          errors: JSON.stringify([{ error: apiError instanceof Error ? apiError.message : 'API fetch failed' }]),
          completedAt: new Date(),
        },
      });
      throw apiError;
    }

    // Audit log if session-based auth
    if (sessionUser) {
      await db.auditLog.create({
        data: {
          entityType: 'project',
          entityId: 'batch',
          action: 'sync',
          changes: JSON.stringify({
            source: 'zakuppro',
            fetched: result.fetched,
            synced: result.synced,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors.length,
          }),
          userId: sessionUser.id,
        },
      });
    }

    return NextResponse.json({
      ...result,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('POST /sync/zakuppro error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка синхронизации с ZakupPro' },
      { status: 500 }
    );
  }
}

// GET: Check ZakupPro connection status and last sync info
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const isApiKey = validateApiKey(request);
    const session = await getServerSession(authOptions);
    let isAuthorized = isApiKey;

    if (!isAuthorized && session?.user) {
      const user = await getCurrentUser();
      isAuthorized = !!(user && (user.role === 'owner' || user.role === 'accountant'));
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    // Check API connectivity
    const connectionStatus = await validateZakupProConnection();

    // Get last sync log
    const lastSync = await db.syncLog.findFirst({
      where: { source: 'zakuppro' },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json({
      connection: connectionStatus,
      lastSync: lastSync ? {
        status: lastSync.status,
        recordsTotal: lastSync.recordsTotal,
        recordsSynced: lastSync.recordsSynced,
        startedAt: lastSync.startedAt,
        completedAt: lastSync.completedAt,
        errors: lastSync.errors,
      } : null,
      apiKeyConfigured: !!process.env.ZAKUPPRO_API_KEY,
      apiUrl: process.env.ZAKUPPRO_API_URL || 'not configured',
    });
  } catch (error) {
    logger.error('GET /sync/zakuppro error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Ошибка проверки статуса' },
      { status: 500 }
    );
  }
}
