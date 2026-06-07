/**
 * Next.js Middleware — Security Headers, Rate Limiting
 * 
 * Features:
 * - Security headers on ALL responses (X-Content-Type-Options, X-Frame-Options, etc.)
 * - Rate limiting for API routes
 * - Cache-Control: no-store for API responses
 * - CSRF protection via SameSite cookies (configured in auth.ts)
 * 
 * Note: Custom CSRF token validation is available in @/lib/csrf but not enforced
 * here to avoid breaking frontend. SameSite=Lax cookies provide baseline protection.
 * CSRF validation can be enabled in the future once the frontend is updated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

/** Security headers applied to ALL responses */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith('/api/');

  // === API Routes: Rate Limiting + Security Headers ===
  if (isApiRoute) {
    // Skip rate limiting for auth and cron routes
    const skipRateLimit = pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/');

    if (!skipRateLimit) {
      const result = rateLimit(request);
      const headers = getRateLimitHeaders(result);

      if (!result.success) {
        const response = NextResponse.json(
          { error: 'Слишком много запросов. Попробуйте позже.' },
          {
            status: 429,
            headers: {
              ...headers,
              'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
            },
          }
        );

        // Add security headers even on 429 responses
        for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
          response.headers.set(key, value);
        }
        response.headers.set('Cache-Control', 'no-store');

        return response;
      }

      // Continue with rate limit headers
      const response = NextResponse.next();
      for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
      }

      // Add security headers
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        response.headers.set(key, value);
      }

      // Add no-store for API responses
      response.headers.set('Cache-Control', 'no-store');

      return response;
    }

    // Auth/cron routes: just add security headers
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  // === Non-API routes: just add security headers ===
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
