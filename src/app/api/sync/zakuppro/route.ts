import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey, apiKeyOrSession } from '@/lib/api-key-auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

// Mock ZakupPro API data — simulates fetching projects from an external service
function getMockZakupProProjects() {
  const projects = [];
  for (let i = 1; i <= 10; i++) {
    const num = String(i).padStart(6, '0');
    projects.push({
      externalId: `ПМ${num}`,
      name: `Проект ZakupPro #${i}`,
      contractAmount: Math.round((500_000 + Math.random() * 4_500_000) * 100) / 100,
      status: i <= 3 ? 'active' : i <= 7 ? 'lead' : 'completed',
      startDate: new Date(2025, Math.floor(Math.random() * 6), 1).toISOString(),
      endDate: i > 7 ? new Date(2025, 11, 31).toISOString() : null,
    });
  }
  return projects;
}

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

    const authResult = { authenticated: isApiKey || isSession, isApiKey };
    if (!apiKeyOrSession(authResult)) {
      return NextResponse.json(
        { error: 'Требуется авторизация. Используйте X-API-Key или авторизованную сессию с ролью owner.' },
        { status: 401 }
      );
    }

    // Simulate fetching from ZakupPro external API
    const zakupProProjects = getMockZakupProProjects();

    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: Array<{ externalId: string; error: string }> = [];

    for (const zpProject of zakupProProjects) {
      try {
        const existing = await db.project.findUnique({
          where: { externalId: zpProject.externalId },
        });

        if (existing) {
          // Update if name or amount changed
          const needsUpdate =
            existing.name !== zpProject.name ||
            existing.contractAmount !== zpProject.contractAmount;

          if (needsUpdate) {
            await db.project.update({
              where: { id: existing.id },
              data: {
                name: zpProject.name,
                contractAmount: zpProject.contractAmount,
              },
            });
            updated++;
          }
        } else {
          // Create new project with status "lead"
          await db.project.create({
            data: {
              externalId: zpProject.externalId,
              name: zpProject.name,
              contractAmount: zpProject.contractAmount,
              status: 'lead',
              startDate: zpProject.startDate ? new Date(zpProject.startDate) : null,
              endDate: zpProject.endDate ? new Date(zpProject.endDate) : null,
            },
          });
          created++;
        }

        synced++;
      } catch (err) {
        console.error(`Error syncing project ${zpProject.externalId}:`, err);
        errors.push({
          externalId: zpProject.externalId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Audit log if session-based auth
    if (sessionUser) {
      await db.auditLog.create({
        data: {
          entityType: 'project',
          entityId: 'batch',
          action: 'import',
          changes: JSON.stringify({ source: 'zakuppro', synced, created, updated }),
          userId: sessionUser.id,
        },
      });
    }

    return NextResponse.json({
      synced,
      created,
      updated,
      errors,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('POST /sync/zakuppro error:', error);
    return NextResponse.json(
      { error: 'Ошибка синхронизации с ZakupPro' },
      { status: 500 }
    );
  }
}
