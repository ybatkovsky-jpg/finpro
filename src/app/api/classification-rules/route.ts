import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const rules = await db.classificationRule.findMany({
      include: {
        category: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true, externalId: true } },
      },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json(rules);
  } catch (error) {
    logger.error('GET /api/classification-rules error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch classification rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }
    try {
      requireRole(user, 'owner', 'accountant');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const body = await request.json();
    const { keyword, categoryId, counterpartyKeyword, projectId, priority, isActive } = body;

    if (!keyword || !categoryId) {
      return NextResponse.json(
        { error: 'keyword and categoryId are required' },
        { status: 422 }
      );
    }

    // Validate category exists
    const category = await db.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Validate project if provided
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const rule = await db.classificationRule.create({
      data: {
        keyword,
        categoryId,
        counterpartyKeyword: counterpartyKeyword || null,
        projectId: projectId || null,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
      include: {
        category: { select: { id: true, name: true, type: true } },
        project: { select: { id: true, name: true, externalId: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'classification_rule',
        entityId: rule.id,
        action: 'create',
        changes: JSON.stringify({ keyword, categoryId, counterpartyKeyword, projectId, priority, isActive }),
        userId: user.id,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    logger.error('POST /api/classification-rules error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create classification rule' },
      { status: 500 }
    );
  }
}
