import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

const VALID_STATUSES = ['lead', 'active', 'completed', 'cancelled'];
const EXTERNAL_ID_PATTERN = /^ПМ\d{6}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { externalId: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, email: true } },
          _count: { select: { transactions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.project.count({ where }),
    ]);

    return NextResponse.json({
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // RBAC: require owner or manager
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }
    try {
      requireRole(user, 'owner', 'manager');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const body = await request.json();
    const {
      externalId,
      name,
      clientId,
      status = 'lead',
      contractAmount,
      startDate,
      endDate,
      managerId,
    } = body;

    // Validation
    if (!externalId) {
      return NextResponse.json(
        { error: 'externalId is required' },
        { status: 422 }
      );
    }

    if (!EXTERNAL_ID_PATTERN.test(externalId)) {
      return NextResponse.json(
        { error: 'externalId must match pattern ПМ###### (e.g., ПМ000001)' },
        { status: 422 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 422 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 422 }
      );
    }

    // Check for duplicate externalId
    const existing = await db.project.findUnique({ where: { externalId } });
    if (existing) {
      return NextResponse.json(
        { error: 'Project with this externalId already exists' },
        { status: 409 }
      );
    }

    const project = await db.project.create({
      data: {
        externalId,
        name,
        clientId: clientId || null,
        status,
        contractAmount: contractAmount ?? null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        managerId: managerId || null,
      },
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'project',
        entityId: project.id,
        action: 'create',
        changes: JSON.stringify({ name: project.name, externalId: project.externalId }),
        userId: user.id,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /projects error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
