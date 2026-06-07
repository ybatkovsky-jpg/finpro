import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { db } from "@/lib/db"
import { generateCsrfToken } from "@/lib/csrf"

export const roleLabels: Record<string, string> = {
  owner: "Собственник",
  accountant: "Бухгалтер",
  manager: "Менеджер",
  storekeeper: "Кладовщик",
}

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const JWT_MAX_AGE = 24 * 60 * 60 // 24 hours

export async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

  await db.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  })

  return token
}

export async function validateRefreshToken(token: string): Promise<{ valid: boolean; userId?: string }> {
  const refreshToken = await db.refreshToken.findUnique({
    where: { token },
  })

  if (!refreshToken) {
    return { valid: false }
  }

  if (new Date() > refreshToken.expiresAt) {
    // Token expired, clean it up
    await db.refreshToken.delete({ where: { token } }).catch(() => {})
    return { valid: false }
  }

  return { valid: true, userId: refreshToken.userId }
}

export async function deleteRefreshToken(token: string): Promise<void> {
  try {
    await db.refreshToken.delete({ where: { token } })
  } catch {
    // Token may already be deleted
  }
}

export async function cleanExpiredRefreshTokens(userId: string): Promise<void> {
  try {
    await db.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    })
  } catch {
    // Ignore cleanup errors
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Введите email и пароль")
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error("Пользователь не найден")
        }

        if (!user.isActive) {
          throw new Error("Аккаунт отключён. Обратитесь к администратору.")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Неверный пароль")
        }

        // Create a refresh token on successful login
        const refreshToken = await createRefreshToken(user.id)

        // Generate CSRF token for custom API protection
        const csrfToken = generateCsrfToken()

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          refreshToken,
          csrfToken,
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: JWT_MAX_AGE,
  },
  jwt: {
    maxAge: JWT_MAX_AGE,
  },
  // Ensure cookies use SameSite=Lax for CSRF protection
  // Use __Secure- and __Host- prefixes only in production (requires HTTPS)
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production"
        ? `__Host-next-auth.callback-url`
        : `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production"
        ? `__Host-next-auth.csrf-token`
        : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, user object is present
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
        token.refreshToken = (user as { refreshToken: string }).refreshToken
        token.csrfToken = (user as { csrfToken: string }).csrfToken

        // Clean up expired refresh tokens for this user
        await cleanExpiredRefreshTokens(user.id)

        return token
      }

      // On subsequent calls, check if JWT is about to expire
      // If less than half the max age remains, try to refresh
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = token.exp as number | undefined

      if (expiresAt) {
        const timeRemaining = expiresAt - now
        const shouldRefresh = timeRemaining < JWT_MAX_AGE / 2

        if (shouldRefresh && token.refreshToken) {
          const validation = await validateRefreshToken(token.refreshToken as string)
          if (validation.valid) {
            // JWT will be automatically extended by NextAuth when we return the token
            // The iat (issued at) is updated, extending the expiry
            return {
              ...token,
              iat: now,
            }
          } else {
            // Refresh token is invalid, clear it
            token.refreshToken = undefined
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}
