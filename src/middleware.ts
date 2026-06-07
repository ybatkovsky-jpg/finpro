/**
 * Next.js Middleware — Rate Limiting for API routes
 * Applies rate limiting to all /api/* routes except /api/auth/* and /api/cron/*
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for auth and cron routes
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  // Apply rate limiting
  const result = rateLimit(request);
  const headers = getRateLimitHeaders(result);

  if (!result.success) {
    // Rate limit exceeded — return 429
    return NextResponse.json(
      { error: 'Слишком много запросов. Попробуйте позже.' },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
        },
      }
    );
  }

  // Add rate limit headers to response
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
