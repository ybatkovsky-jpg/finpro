/**
 * In-memory Rate Limiter for FinPro
 * Simple per-IP rate limiting using a Map.
 * Default: 100 requests per 60 seconds per IP.
 */

import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Configuration
const WINDOW_MS = 60_000; // 60 seconds
const MAX_REQUESTS = 100; // per window

// Cleanup old entries periodically (every 5 minutes)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60_000;

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function rateLimit(request: NextRequest): RateLimitResult {
  cleanup();

  // Get IP address
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const now = Date.now();
  const entry = store.get(ip);

  let limit = MAX_REQUESTS;
  let remaining: number;
  let reset: number;
  let success: boolean;

  if (!entry || now > entry.resetTime) {
    // New window
    reset = now + WINDOW_MS;
    remaining = limit - 1;
    success = true;
    store.set(ip, { count: 1, resetTime: reset });
  } else {
    // Existing window
    entry.count++;
    remaining = Math.max(0, limit - entry.count);
    reset = entry.resetTime;
    success = entry.count <= limit;
  }

  return { success, limit, remaining, reset };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  };
}
