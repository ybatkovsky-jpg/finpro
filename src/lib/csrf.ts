/**
 * CSRF Protection for FinPro
 * Double-submit cookie pattern:
 * - A csrf-token cookie is set on login
 * - State-changing requests (POST/PUT/DELETE) must include X-CSRF-Token header matching the cookie
 * - NextAuth handles its own CSRF for auth routes
 */

import crypto from 'crypto';

/**
 * Generate a new CSRF token using crypto.randomUUID
 */
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

/**
 * Validate that the request CSRF token matches the cookie token
 * Both must be present and identical
 */
export function validateCsrfToken(token: string | null, cookieToken: string | null): boolean {
  if (!token || !cookieToken) return false;
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    const tokenBuf = Buffer.from(token, 'utf-8');
    const cookieBuf = Buffer.from(cookieToken, 'utf-8');
    
    if (tokenBuf.length !== cookieBuf.length) return false;
    
    return crypto.timingSafeEqual(tokenBuf, cookieBuf);
  } catch {
    return false;
  }
}

/**
 * Check if a request path should skip CSRF validation
 * NextAuth, cron, and health endpoints use different auth mechanisms
 */
export function shouldSkipCsrf(pathname: string): boolean {
  const skipPaths = [
    '/api/auth/',
    '/api/cron/',
    '/api/health',
  ];
  return skipPaths.some(p => pathname.startsWith(p));
}

/**
 * Check if the request method requires CSRF validation
 */
export function requiresCsrfValidation(method: string): boolean {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
}
