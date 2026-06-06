import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { inn: { contains: search } },
      ];
    }

    const clients = await db.client.findMany({
      where,
      include: {
        _count: { select: { projects: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: clients });
  } catch (error) {
    console.error('GET /clients error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, inn, phone, email } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 422 }
      );
    }

    const client = await db.client.create({
      data: {
        name,
        inn: inn || null,
        phone: phone || null,
        email: email || null,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('POST /clients error:', error);
    if (String(error).includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Client with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
