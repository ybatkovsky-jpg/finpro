import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateRefreshToken, createRefreshToken, deleteRefreshToken } from '@/lib/auth'
import { getToken } from 'next-auth/jwt'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('finpro-refresh-token')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      )
    }

    // Validate the refresh token
    const validation = await validateRefreshToken(refreshToken)

    if (!validation.valid || !validation.userId) {
      // Clear the invalid cookie
      const response = NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
      response.cookies.set('finpro-refresh-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
      return response
    }

    // Delete the old refresh token
    await deleteRefreshToken(refreshToken)

    // Create a new refresh token
    const newRefreshToken = await createRefreshToken(validation.userId)

    // Get the current JWT to extend it
    const currentToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    // Build the response
    const response = NextResponse.json({
      success: true,
      message: 'Session refreshed',
      user: currentToken
        ? {
            id: currentToken.id,
            email: currentToken.email,
            name: currentToken.name,
            role: currentToken.role,
          }
        : null,
    })

    // Set the new refresh token cookie
    response.cookies.set('finpro-refresh-token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('POST /auth/refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    )
  }
}
