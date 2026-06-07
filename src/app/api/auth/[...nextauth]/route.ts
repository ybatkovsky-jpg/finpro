import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest } from "next/server"

async function handler(request: NextRequest) {
  // Intercept the NextAuth handler to set our custom csrf-token cookie
  // after successful sign-in
  const nextAuthHandler = NextAuth(authOptions)
  const response = await nextAuthHandler(request)
  
  // If this is a POST to /api/auth/callback/credentials (sign-in),
  // and the response is successful (redirect or 200),
  // set the csrf-token cookie for our custom API protection
  if (
    request.method === 'POST' &&
    request.nextUrl.pathname.includes('/callback/credentials')
  ) {
    // Check if the response indicates success (not an error redirect)
    const location = response.headers.get('location') || ''
    const isError = location.includes('error=') || location.includes('CallbackRouteError')
    
    if (!isError) {
      // Extract the CSRF token from the JWT — we stored it in the token
      // For simplicity, generate a new one here for the cookie
      const { generateCsrfToken } = await import('@/lib/csrf')
      const csrfToken = generateCsrfToken()
      
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: false, // Must be readable by JavaScript for double-submit pattern
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 24 hours
      })
    }
  }
  
  return response
}

export { handler as GET, handler as POST }
