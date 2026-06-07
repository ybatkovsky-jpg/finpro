/**
 * Input Sanitization for FinPro
 * Provides utilities to clean and validate user input
 * preventing XSS, injection, and malformed data
 */

/**
 * Strip HTML tags, trim whitespace, normalize unicode
 * Safe for storing in database and displaying in UI
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    // Normalize unicode (NFC form — canonical decomposition followed by canonical composition)
    .normalize('NFC')
    // Strip HTML tags — match anything between < and >
    .replace(/<[^>]*>/g, '')
    // Strip script event handlers that might survive tag stripping
    .replace(/on\w+\s*=/gi, '')
    // Strip javascript: URLs
    .replace(/javascript:/gi, '')
    // Trim whitespace
    .trim()
    // Collapse multiple spaces into one
    .replace(/\s{2,}/g, ' ');
}

/**
 * Ensure a valid finite number, rounded to 2 decimal places
 * Returns 0 for invalid inputs
 */
export function sanitizeNumber(input: unknown): number {
  const num = Number(input);
  
  if (!Number.isFinite(num)) return 0;
  
  // Round to 2 decimal places (financial precision)
  return Math.round(num * 100) / 100;
}

/**
 * Parse and validate a date string
 * Returns null for invalid dates
 * Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function sanitizeDate(input: string): Date | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  
  const trimmed = input.trim();
  
  // Basic format validation: must look like a date
  // Accept YYYY-MM-DD or ISO 8601
  const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!datePattern.test(trimmed)) return null;
  
  const date = new Date(trimmed);
  
  // Check if date is valid (Invalid Date → NaN)
  if (isNaN(date.getTime())) return null;
  
  // Sanity check: date must be between 2000-01-01 and 2100-01-01
  const minDate = new Date('2000-01-01');
  const maxDate = new Date('2100-01-01');
  if (date < minDate || date > maxDate) return null;
  
  return date;
}

/**
 * Sanitize a URL string — only allow http, https, and relative URLs
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== 'string') return '';
  
  const trimmed = input.trim();
  
  // Allow relative URLs
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  
  // Only allow http and https protocols
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  
  // Reject everything else (javascript:, data:, etc.)
  return '';
}

/**
 * Sanitize an enum-like string — only allow values from a whitelist
 */
export function sanitizeEnum<T extends string>(input: string, allowed: T[]): T | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  return allowed.find(a => a.toLowerCase() === trimmed) ?? null;
}
