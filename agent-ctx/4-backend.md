---
Task ID: 4-backend
Agent: backend
Task: Implement Stage 4 Backend — PDF Reports, Auto-sync ZakupPro, Rate Limiting, Health Check, Structured Logging

Work Log:
- Installed pdfkit and @types/pdfkit dependencies
- Added `serverExternalPackages: ["pdfkit"]` to next.config.ts to fix pdfkit font path resolution in Next.js runtime
- Created structured logger (src/lib/logger.ts):
  - Levels: debug, info, warn, error with priority filtering
  - Production: JSON format output
  - Development: human-readable format with colors
  - Context object support for structured logging
  - LOG_LEVEL env var support
- Created rate limiter (src/lib/rate-limit.ts):
  - In-memory per-IP rate limiting using Map
  - Default: 100 requests per 60 seconds per IP
  - X-Forwarded-For / X-Real-IP header support
  - Automatic cleanup of stale entries every 5 minutes
  - Exports: rateLimit(), getRateLimitHeaders()
- Created middleware (src/middleware.ts):
  - Applies rate limiting to all /api/* routes
  - Skips /api/auth/* and /api/cron/* routes
  - Returns 429 with JSON error when rate limit exceeded
  - Adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
- Created health check API (src/app/api/health/route.ts):
  - GET handler, no auth required
  - Returns: status (ok/degraded), timestamp, database check, version, uptime, memory, environment
- Created cron sync API (src/app/api/cron/sync/route.ts):
  - POST handler triggers ZakupPro sync
  - Protected by X-API-Key auth
  - Calls fetchZakupProProjects and syncs projects
  - Logs to SyncLog
  - Returns sync results with triggeredBy: 'cron'
- Created cron 1c-watch API (src/app/api/cron/1c-watch/route.ts):
  - POST handler scans configured watch directory for new 1C .txt files
  - Protected by X-API-Key auth
  - Dual encoding support (Win-1251 / UTF-8)
  - Imports transactions with auto-classification
  - Updates ImportConfig.lastImportAt and creates SyncLog
- Added PDF export to project P&L route:
  - format=pdf generates professional PDF using pdfkit
  - Company header: "ООО ПРО Мебель"
  - Report title, project name/externalId, period
  - Revenue line, COGS breakdown with categories/subcategories
  - Total COGS, Gross Profit, Gross Margin %
  - Russian number formatting (space as thousands separator)
  - "Сформирован:" timestamp at bottom
  - Uses DejaVu Sans font for Cyrillic support
- Added PDF export to business P&L route:
  - format=pdf generates professional PDF
  - Company header: "ООО ПРО Мебель"
  - Full P&L table: Выручка, COGS, Валовая прибыль, Операционные расходы, EBIT, УСН 15%, Чистая прибыль
  - Project breakdown table with columns: Код, Проект, Выручка, Себестоимость, Прибыль, Маржа
  - Totals row and "Сформирован:" timestamp
- Updated existing API routes to use structured logger:
  - src/app/api/margin/route.ts — console.error → logger.error
  - src/app/api/dashboard/route.ts — console.error → logger.error
  - src/app/api/transactions/route.ts — console.error → logger.error
  - src/app/api/imports/1c-clientbank/route.ts — console.log → logger.info, console.error → logger.error
  - src/app/api/import-config/route.ts — console.error → logger.error
  - src/app/api/import-config/1c-auto/route.ts — console.error → logger.error
  - src/app/api/classification-rules/route.ts — console.error → logger.error
  - src/app/api/periods/route.ts — console.error → logger.error
  - src/app/api/sync/zakuppro/route.ts — console.error → logger.error
- Added auth to API routes that were missing it:
  - src/app/api/import-config/route.ts GET — added getServerSession check
  - src/app/api/periods/route.ts GET — added getServerSession check
  (classification-rules already had auth on both GET and POST)
- Verified: lint passes clean, all API endpoints respond correctly
- Tested: health check returns ok, cron sync works with API key, rate limit headers present on API responses, PDF export generates valid PDF files

Stage Summary:
- 7 new features implemented:
  1. PDF P&L reports for both project and business (using pdfkit with DejaVu Sans Cyrillic font)
  2. Cron API for ZakupPro auto-sync (X-API-Key protected)
  3. Cron API for 1C watch directory auto-import (X-API-Key protected)
  4. In-memory rate limiting middleware (100 req/60s per IP, skips auth/cron)
  5. Health check API (database status, version, uptime, memory)
  6. Structured logger (JSON in prod, colored in dev, context support)
  7. Auth added to previously unprotected GET endpoints (import-config, periods)
