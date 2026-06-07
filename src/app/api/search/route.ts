import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() || ''

  if (q.length < 1) {
    return NextResponse.json({
      projects: [],
      counterparties: [],
      categories: [],
      transactions: [],
      users: [],
    })
  }

  const searchTerm = `%${q}%`

  try {
    // Search projects (name or externalId)
    const projects = await db.project.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { externalId: { contains: q } },
        ],
      },
      select: { id: true, name: true, externalId: true, status: true },
      take: 5,
    })

    // Search counterparties (name)
    const counterparties = await db.counterparty.findMany({
      where: {
        name: { contains: q },
      },
      select: { id: true, name: true, type: true },
      take: 5,
    })

    // Search categories (name)
    const categories = await db.category.findMany({
      where: {
        name: { contains: q },
      },
      select: { id: true, name: true, type: true },
      take: 5,
    })

    // Search transactions (description)
    const transactions = await db.transaction.findMany({
      where: {
        description: { contains: q },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        date: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 5,
    })

    // Search users (name or email)
    const users = await db.user.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
        ],
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
      take: 5,
    })

    return NextResponse.json({
      projects,
      counterparties,
      categories,
      transactions: transactions.map((t) => ({
        ...t,
        date: t.date.toISOString(),
      })),
      users,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 })
  }
}
