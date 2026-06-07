# Task 5 — Backend: Security Hardening, Database Backups, PostgreSQL Migration, Production Config

## Agent: backend
## Task ID: 5-backend

## Work Completed:

### 1. CSRF Protection (Simplified — SameSite Cookies)
- Created `/src/lib/csrf.ts`: generateCsrfToken(), validateCsrfToken() with timing-safe comparison, shouldSkipCsrf(), requiresCsrfValidation()
- Updated `/src/lib/auth.ts`: Added SameSite=Lax cookie configuration for all NextAuth cookies (sessionToken, callbackUrl, csrfToken) with environment-conditional naming (__Secure-/__Host- prefixes only in production)
- Added csrfToken generation on login (stored in JWT for future use)
- Updated `/src/app/api/auth/[...nextauth]/route.ts`: Sets csrf-token cookie on successful sign-in for double-submit pattern (not enforced yet per task notes)
- **Decision**: Did NOT enforce CSRF token validation in middleware per task notes — "Skip the custom CSRF implementation since it would require frontend changes that could break things." SameSite=Lax cookies provide baseline protection.

### 2. Security Headers
- Updated `/src/middleware.ts` with comprehensive security headers on ALL responses:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
  - Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'
  - Cache-Control: no-store for all API routes
- Matcher updated to apply to all routes (not just /api/*)

### 3. Input Sanitization
- Created `/src/lib/sanitize.ts` with:
  - sanitizeString(): strips HTML tags, normalizes unicode (NFC), trims whitespace, removes script handlers
  - sanitizeNumber(): ensures finite number, rounds to 2 decimals
  - sanitizeDate(): validates YYYY-MM-DD or ISO 8601 format, sanity checks (2000-2100)
  - sanitizeUrl(): only allows http/https and relative URLs
  - sanitizeEnum(): whitelist-based enum validation
- Updated `/src/app/api/transactions/route.ts`: POST handler sanitizes description, externalId (sanitizeString), amount (sanitizeNumber), date (sanitizeDate)
- Updated `/src/app/api/projects/route.ts`: POST handler sanitizes name, externalId (sanitizeString), startDate/endDate (sanitizeDate), contractAmount (sanitizeNumber)

### 4. Database Backup API
- Created `/src/app/api/backup/route.ts`:
  - POST: owner-only, detects SQLite vs PostgreSQL by DATABASE_URL, reads .db file for SQLite / runs pg_dump for PostgreSQL, returns as download with Content-Disposition header, logs to AuditLog
  - GET: owner-only, returns backup capability info (engine, backupPath)
- Created `/scripts/backup.sh`: Auto-detects DB type, creates timestamped backup, gzip compression, keeps last 30 backups
- Created `/scripts/restore.sh`: Interactive restore with confirmation prompt, auto-detects DB type

### 5. PostgreSQL Migration
- Created `/prisma/schema.postgresql.prisma`: Complete schema with provider = "postgresql" (all 14 models)
- Created `/scripts/migrate-to-pg.sh`: 5-step migration script (switch schema → set DATABASE_URL → prisma migrate → prisma generate → seed)
- Existing SQLite schema preserved as-is for development

### 6. Production Next.js Config
- Updated `/next.config.ts`:
  - output: "standalone"
  - reactStrictMode: true
  - poweredByHeader: false (removes X-Powered-By)
  - serverExternalPackages: ["pdfkit"]
  - Static security headers via headers() config

### 7. Docker Production Config
- Updated `/Dockerfile`:
  - Added postgresql16-client for pg_dump backups
  - Added font-dejavu-sans for pdfkit Cyrillic support
  - Copy backup scripts to /app/scripts
  - Copy pdfkit font data and system DejaVu fonts
  - Create /app/backups directory
  - HEALTHCHECK instruction (wget /api/health every 30s)
- Updated `/docker-compose.yml`:
  - Added backups volume
  - Added BACKUP_PATH environment variable
  - Added healthcheck for app container
  - Caddy depends_on app with condition: service_healthy

### 8. Production Environment Template
- Created `/.env.production.example`: Complete template with PostgreSQL, NextAuth, API keys, ZakupPro, 1C import, backup path, logging, and Docker variables

### 9. Production Caddyfile
- Updated `/Caddyfile` with:
  - Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, -Server)
  - gzip compression
  - Static file caching (1 year immutable)
  - No-store for API routes and health endpoint
  - {$HOST:localhost} variable for flexibility

### 10. Build Verification
- Lint passes clean
- Next.js build passes (42 API routes, 2 static pages)
- Dev server running successfully

## Files Created:
- `/src/lib/csrf.ts`
- `/src/lib/sanitize.ts`
- `/src/app/api/backup/route.ts`
- `/scripts/backup.sh`
- `/scripts/restore.sh`
- `/scripts/migrate-to-pg.sh`
- `/prisma/schema.postgresql.prisma`
- `/.env.production.example`

## Files Modified:
- `/src/middleware.ts` — Security headers on all routes, rate limiting + Cache-Control on API
- `/src/lib/auth.ts` — SameSite=Lax cookies, environment-conditional cookie names, csrfToken in JWT
- `/src/app/api/auth/[...nextauth]/route.ts` — Sets csrf-token cookie on login
- `/src/app/api/transactions/route.ts` — Input sanitization
- `/src/app/api/projects/route.ts` — Input sanitization
- `/next.config.ts` — Production config (poweredByHeader: false, strict mode, security headers)
- `/Dockerfile` — pg_dump support, fonts, healthcheck, backup scripts
- `/docker-compose.yml` — Backup volume, healthcheck, BACKUP_PATH env
- `/Caddyfile` — Production config with security headers and caching
