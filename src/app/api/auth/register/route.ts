import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth-guard"

const validRoles = ["owner", "accountant", "manager", "storekeeper"]

export async function POST(req: NextRequest) {
  try {
    // Only owners can create new users
    const currentUser = await requireRole("owner")

    const body = await req.json()
    const { email, name, password, role } = body

    // Validate required fields
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Email, имя и пароль обязательны" },
        { status: 400 }
      )
    }

    // Validate role
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Роль должна быть одной из: ${validRoles.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть не менее 6 символов" },
        { status: 400 }
      )
    }

    // Check email uniqueness
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user
    const user = await db.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      { message: "Пользователь создан", user },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Внутренняя ошибка сервера"

    if (message === "Требуется авторизация") {
      return NextResponse.json({ error: message }, { status: 401 })
    }

    if (message === "Недостаточно прав для выполнения действия") {
      return NextResponse.json({ error: message }, { status: 403 })
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
