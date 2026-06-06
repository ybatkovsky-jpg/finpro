import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCurrentUser, requireRole } from '@/lib/auth-guard';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search };
    }
    if (type) {
      where.type = type;
    }

    const counterparties = await db.counterparty.findMany({
      where,
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: counterparties });
  } catch (error) {
    console.error('GET /counterparties error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch counterparties' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // RBAC: require owner or accountant
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
    const { name, inn, type } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 422 }
      );
    }

    const counterparty = await db.counterparty.create({
      data: {
        name,
        inn: inn || null,
        type: type || null,
      },
    });

    return NextResponse.json(counterparty, { status: 201 });
  } catch (error) {
    console.error('POST /counterparties error:', error);
    if (String(error).includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Counterparty with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create counterparty' },
      { status: 500 }
    );
  }
}
