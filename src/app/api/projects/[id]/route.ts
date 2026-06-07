import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

const VALID_STATUSES = ['lead', 'active', 'completed', 'cancelled'];
const EXTERNAL_ID_PATTERN = /^ПМ\d{6}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        client: true,
        manager: { select: { id: true, name: true, email: true } },
        transactions: {
          include: {
            category: { select: { id: true, name: true, type: true } },
            counterparty: { select: { id: true, name: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('GET /projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Validate externalId if provided
    if (body.externalId !== undefined && !EXTERNAL_ID_PATTERN.test(body.externalId)) {
      return NextResponse.json(
        { error: 'externalId must match pattern ПМ###### (e.g., ПМ000001)' },
        { status: 422 }
      );
    }

    // Validate status if provided
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 422 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'externalId',
      'name',
      'clientId',
      'status',
      'contractAmount',
      'managerId',
      'marginTarget',
      'qualityRating',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Handle date fields separately
    if (body.startDate !== undefined) {
      updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    }
    if (body.endDate !== undefined) {
      updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    const project = await db.project.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'project',
        entityId: id,
        action: 'update',
        changes: JSON.stringify(updateData),
        userId: user.id,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('PUT /projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: require owner only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 });
    }
    try {
      requireRole(user, 'owner');
    } catch {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    await db.project.delete({ where: { id } });

    // Audit log
    await db.auditLog.create({
      data: {
        entityType: 'project',
        entityId: id,
        action: 'delete',
        changes: JSON.stringify({
          name: existing.name,
          externalId: existing.externalId,
          status: existing.status,
        }),
        userId: user.id,
      },
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('DELETE /projects/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
