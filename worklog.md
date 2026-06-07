---
Task ID: 1
Agent: main
Task: Implement FinPro management accounting system per SRS specification

Work Log:
- Created Prisma schema with 7 models: User, Client, Counterparty, Category (with hierarchy), Project, Transaction, AuditLog
- Pushed schema to SQLite database
- Created 12 API route handlers:
  - CRUD: /api/transactions, /api/projects, /api/categories, /api/counterparties, /api/clients
  - Reports: /api/reports/pnl/project/[projectId], /api/reports/pnl/business
  - Import: /api/imports/1c-clientbank, /api/imports/csv
  - Dashboard: /api/dashboard
- Seeded database with demo data (4 users, 5 clients, 6 counterparties, 12 categories, 5 projects, 33 transactions)
- Built complete single-page UI with Zustand state management:
  - Sidebar navigation (collapsible, dark theme, emerald accent)
  - Dashboard view (KPI cards, revenue/expense chart, project profitability, recent transactions)
  - Transactions view (filterable table, pagination, create/edit dialog)
  - Projects view (card grid, status badges, project detail with financials)
  - Reports view (P&L by project and by business with charts)
  - Import view (1C ClientBank and CSV upload)
  - Categories view (hierarchical, income/expense columns)
  - Counterparties view (searchable table)
- Verified all views via browser automation
- Lint passes clean
- All API endpoints respond correctly

Stage Summary:
- FinPro is fully functional with all Stage 1 features implemented
- Dashboard shows live data from seeded database
- P&L reports calculate correctly (Revenue, COGS, Gross Profit, EBIT, USN Tax, Net Profit)
- Transaction CRUD with validation (amount > 0, future date warning, audit logging)
- Import endpoints for 1C ClientBank and CSV formats

---
Task ID: 2
Agent: main
Task: Implement FinPro Stage 2 — budgets, cash flow, notifications, audit, users, real ZakupPro API

Work Log:
- Added ZAKUPPRO_API_KEY and ZAKUPPRO_API_URL to .env
- Extended Prisma schema with 4 new models: Budget, CashFlowPayment, Notification, SyncLog
- Pushed updated schema to SQLite database
- Created real ZakupPro API client (src/lib/zakuppro.ts) with:
  - fetchZakupProProjects() — paginated API fetch
  - validateZakupProConnection() — connectivity check
  - mapZakupProStatus() — status mapping (Russian → FinPro)
- Updated /api/sync/zakuppro route: replaced mock with real API calls, added GET for status check, SyncLog recording
- Created Budget API: GET/POST /api/budgets, PUT/DELETE /api/budgets/[id] with plan vs actual calculation
- Created Cash Flow API: GET/POST /api/cashflow, PUT/DELETE /api/cashflow/[id] with cash gap detection
- Created Notifications API: GET/POST/PUT /api/notifications, PUT/DELETE /api/notifications/[id]
- Created Audit API: GET /api/audit with filters (entityType, action, date range) and pagination
- Updated Users API: GET/POST /api/users (owner-only), PUT/DELETE /api/users/[id] with soft-delete
- Added 5 new views: BudgetsView, CashFlowView, NotificationsView, AuditView, UsersView
- Enhanced DashboardView: 5 KPI cards, 4 charts (bar, line, category breakdown, budget overview), cash flow overview
- Updated SyncView: connection status card, API key status, last sync info
- Updated Sidebar: 5 groups (Основное, Планирование, Аналитика, Справочники, Администрирование) with role-based filtering
- Updated Store: added 'budgets', 'cashflow', 'notifications', 'audit', 'users' views
- Seeded Stage 2 demo data: 12 budgets, 14 cash flow payments, 6 notifications, 2 sync logs
- Build passed successfully
- Committed and pushed to GitHub (commit 1e891f6)

Stage Summary:
- Stage 2 fully implemented with 6 new modules
- Budget tracking: plan vs actual per project/category with utilization percentage
- Cash Flow: payment calendar, forecast, cash gap detection (July 2026 gap: 275K RUB)
- Notifications: budget overruns, cash gaps, project deadlines, sync errors
- User Management: CRUD with RBAC (owner-only admin access)
- Audit Log: filterable activity log with pagination
- Real ZakupPro API: paginated project fetch with status mapping and sync logging
- Enhanced Dashboard: 5 KPIs, trend charts, category breakdown, budget execution overview

---
Task ID: 3
Agent: main
Task: Implement FinPro Stage 3 — Margin Control, Classification Rules, Period Closing, Enhanced 1C Import

Work Log:
- Updated Prisma schema with 3 new models and 4 new fields:
  - ClassificationRule (keyword, categoryId, counterpartyKeyword, projectId, priority, isActive)
  - PeriodClose (period, closedBy, closedAt, note)
  - ImportConfig (source, watchPath, autoImport, autoClassify, lastImportAt)
  - Project: added marginTarget, completedAt, qualityRating, deadlineStatus
  - User: added periodCloses relation
  - Project: added classificationRules relation
  - Category: added classificationRules relation
- Created period-guard utility (src/lib/period-guard.ts): checkPeriodClosed(), getClosedPeriodForDate()
- Created Margin API: GET /api/margin — margin control dashboard
  - Calculates revenue, expenses, profit, currentMargin per project
  - Determines marginStatus (on_target/at_risk/below_target) based on marginTarget
  - Calculates forecast (burn rate, estimated total cost, estimated final margin)
  - Returns summary stats and margin alerts
- Created Classification Rules API:
  - GET/POST /api/classification-rules — list/create rules with category and project info
  - PUT/DELETE /api/classification-rules/[id] — update/delete rules
  - Rules ordered by priority desc for matching
- Created Period Closing API:
  - GET/POST /api/periods — list closed periods / close a period (owner/accountant only)
  - PUT /api/periods/[id] — reopen a period (owner only, with emergency note)
  - Validates period format (YYYY-MM), prevents duplicate closing
- Updated Transaction APIs with period close check:
  - POST /api/transactions — checks if transaction date falls in closed period, returns 403 if so
  - PUT/DELETE /api/transactions/[id] — same period close check for updates and deletes
- Updated 1C ClientBank Import with dual encoding support:
  - Auto-detects encoding: tries Win-1251 first (using TextDecoder), falls back to UTF-8
  - Accepts both encodings, logs which was detected
  - Added ClassificationRule integration: checks rules table before hardcoded keywordMap
  - Added period close check: rejects transactions in closed periods
  - Returns closedPeriodSkipped count and encoding info in response
  - Updates ImportConfig.lastImportAt after successful import
- Created Import Config API:
  - GET /api/import-config — list all import configurations
  - PUT /api/import-config — update import configuration (watchPath, autoImport, autoClassify)
  - POST /api/import-config/1c-auto — scan watch directory for new .txt files
- Updated Dashboard API:
  - Added authentication check (getServerSession)
  - Added marginSummary data (projects count by margin status)
- Updated seed file with Stage 3 data:
  - 6 ClassificationRules matching furniture keywords (ДСП, МДФ, фурнитура, ткань, поролон, аренда)
  - 2 ImportConfig entries (1c_clientbank, zakuppro)
  - marginTarget on projects (0.25, 0.20, 0.30)
  - deadlineStatus on projects (on_track, at_risk)
  - completedAt and qualityRating on completed project (ПМ000004)
- Updated frontend views to match API responses:
  - MarginView: snake_case summary fields, forecast object instead of forecastMargin, marginStatus in alerts
  - ClassificationRulesView: handle array response from API
  - PeriodsView: handle array response, removed isReopened field (reopened periods are deleted)
- Lint passes clean
- Prisma db push and seed completed successfully

Stage Summary:
- Stage 3 fully implemented with margin control, classification rules, period closing, and enhanced import
- Margin Dashboard: per-project margin tracking with on_target/at_risk/below_target status, burn rate forecasting
- Classification Rules: database-driven auto-classification with priority ordering, replaces hardcoded keywords
- Period Closing: lock periods to prevent transaction edits, owner-only reopen with audit trail
- Enhanced 1C Import: dual encoding (Win-1251/UTF-8), classification rule integration, period check
- Import Config: configure watch paths, auto-import, auto-classify per data source
- Dashboard Auth: all dashboard data now requires authentication
- Seed data: 6 classification rules, 2 import configs, project margin targets and deadline statuses

---
Task ID: 3
Agent: frontend
Task: Implement Stage 3 Frontend UI — Margin Dashboard, Classification Rules, Period Closing, Enhanced Views

Work Log:
- Extended Prisma schema: added isReopened field to PeriodClose model
- Pushed schema to database and regenerated Prisma client
- Created Margin API (GET /api/margin):
  - Calculates revenue, expenses, profit, currentMargin per active project
  - Determines marginStatus (on_target/at_risk/below_target) based on marginTarget
  - Calculates deadlineStatus based on endDate proximity
  - Returns forecast margin, summary stats, and alerts with severity
- Created Classification Rules API:
  - GET/POST /api/classification-rules — list/create with category+project relations
  - PUT/DELETE /api/classification-rules/[id] — update/delete with RBAC
- Created Periods API:
  - GET/POST /api/periods — list/close periods (owner/accountant only)
  - PUT /api/periods/[id] — reopen with isReopened flag (owner only)
  - Prevents closing already-closed periods
- Created Import Config API:
  - GET/PUT /api/import-config — manages 1c_clientbank import configuration
  - Uses upsert pattern with source unique constraint
- Created MarginView component (margin-view.tsx):
  - 4 summary cards: Total Active, On Target (green), At Risk (amber), Below Target (red)
  - Full margin table with columns: Project, Contract, Revenue, Expenses, Profit, Margin%, Target%, Progress bar, Status badge, Deadline badge, Trend icon
  - Margin alerts section with severity color-coding (critical/warning)
  - Summary section with percentage breakdown
- Created ClassificationRulesView component (classification-rules-view.tsx):
  - Table listing all rules with keyword, category, counterparty, project, priority, active status
  - Create/Edit dialog with form fields (keyword, category dropdown, counterparty keyword, project dropdown, priority, active toggle)
  - Delete confirmation dialog
  - Toggle active/inactive with Switch component
  - Fetches categories and projects for dropdowns
- Created PeriodsView component (periods-view.tsx):
  - Table of closed periods: period label, status badge, closed by, date, note
  - Close period form with YYYY-MM format and optional note
  - Reopen confirmation with mandatory emergency note (owner only)
  - Status badges: Closed (green) / Reopened (amber)
- Updated ProjectsView:
  - Added marginData state from /api/margin
  - Project cards show margin % with color coding (green/amber/red)
  - Progress bar showing margin vs target
  - Deadline status badges (В срок / Скоро / Просрочен)
- Updated ProjectForm:
  - Added marginTarget field (percentage input, default 25%)
  - Added qualityRating select (Хорошее / Приемлемое / Требует доработки)
  - Added startDate and endDate date picker inputs
  - Updated form schema, defaults, and reset logic
- Updated ImportView:
  - Added Auto-Import Configuration section at top
  - Toggle for auto-import on/off
  - Watch path input
  - Toggle for auto-classify
  - Last import timestamp display
  - Save config and Import Now buttons
  - Kept existing 1C and CSV file upload sections
- Updated Store: added 'margin', 'classification-rules', 'periods' to View type
- Updated Sidebar:
  - Added Маржинальность (Target icon, Аналитика group)
  - Added Правила классификации (Filter icon, Справочники group)
  - Added Закрытие периодов (Lock icon, Администрирование group, roles: owner/accountant)
- Updated AppLayout:
  - Imported MarginView, ClassificationRulesView, PeriodsView
  - Added cases to ViewRenderer switch
  - Added titles to viewTitles
- Updated DashboardView:
  - Color-coded margin badges: green >= 25%, amber 17.5-25%, red < 17.5%
  - Added Margin Alerts card above recent transactions
  - Fetches alerts from /api/margin
- Updated Project APIs:
  - POST /api/projects: added marginTarget and qualityRating fields
  - PUT /api/projects/[id]: added marginTarget and qualityRating to allowedFields
- Seeded Stage 3 demo data:
  - 12 classification rules with furniture keywords (ЛДСП, МДФ, фурнитура, доставка, etc.)
  - 3 closed periods (2025-10, 2025-11, 2025-12)
  - 1 import config (1c_clientbank with watch path)
  - Updated 5 projects with marginTarget, qualityRating, startDate, endDate
- Lint passes clean

Stage Summary:
- 3 new views: Margin Control Dashboard, Classification Rules, Period Closing
- 4 new API endpoints: /api/margin, /api/classification-rules, /api/periods, /api/import-config
- Enhanced 3 existing views: Projects (margin indicators), Import (auto-config), Dashboard (margin alerts)
- Enhanced Project Form with margin target, quality rating, date pickers
- 3 new sidebar navigation items with role-based access
- Margin tracking with color-coded status (green/amber/red), progress bars, and trend indicators
- Classification rules with priority-based matching and active/inactive toggle
- Period closing with reopen capability (owner-only) and audit trail

---
Task ID: 4
Agent: main
Task: Docker containerization and PostgreSQL migration preparation

Work Log:
- Created Dockerfile: multi-stage build (deps → builder → runner) with Node 20 Alpine
  - Standalone Next.js output, Prisma client bundled, upload directory created
- Created docker-compose.yml: production stack
  - PostgreSQL 16 Alpine with health check
  - Next.js app container with env vars, depends_on PostgreSQL
  - Caddy 2 reverse proxy with HTTP/HTTPS
  - Named volumes: pgdata, uploads, 1c_import, caddy_data, caddy_config
- Created docker-compose.dev.yml: development PostgreSQL only
- Updated Caddyfile: reverse proxy config with security headers template
- Created .env.docker: production environment template
- Updated package.json: added scripts
  - db:migrate:prod, db:switch-pg, db:switch-sqlite
  - docker:dev, docker:up, docker:down
- Saved schema.sqlite.prisma as backup for SQLite provider
- Updated .gitignore: db files, Docker env files, schema backups, uploads
- Build verified: 40 API routes, 16 views, all clean
- Committed and pushed to GitHub (commit b5102e7)

Stage Summary:
- Docker infrastructure ready for Timeweb Cloud deployment
- PostgreSQL migration path: db:switch-pg script + docker-compose.yml
- Production Caddy reverse proxy with HTTPS support
- All Stage 3 features (margin, classification, periods, 1C import, Docker) pushed to GitHub

---
Task ID: 4-frontend
Agent: frontend
Task: Implement Stage 4 Frontend — Global Search (Cmd+K), Keyboard Shortcuts, Mobile Responsive

Work Log:
- Created /api/search/route.ts: global search API endpoint
  - GET handler with `q` query parameter, requires authentication (getServerSession)
  - Searches across projects (name, externalId), counterparties (name), categories (name), transactions (description), users (name, email)
  - Returns results grouped by type with 5 results per group
- Created /src/components/search/command-palette.tsx: global search command palette
  - Opens with Ctrl+K / Cmd+K keyboard shortcut
  - Uses shadcn/ui CommandDialog (cmdk library) for the palette UI
  - Searches across all entity types with debounced API calls (300ms)
  - Shows recent searches from localStorage (key: "finpro-recent-searches", max 10 items)
  - Quick navigation when no query entered (Dashboard, Transactions, Projects, Reports, Margin)
  - Keyboard navigation (arrow up/down, Enter to select, Escape to close)
  - Footer with navigation hints (↑↓ навигация, ↵ выбрать, esc закрыть, ⌘K поиск)
- Created /src/components/keyboard-shortcuts.tsx: global keyboard shortcuts
  - 1/D — Dashboard, 2/T — Transactions, 3/P — Projects, 4/R — Reports, 5/M — Margin
  - ⌘K — Search (handled by CommandPalette)
  - ? — Show keyboard shortcuts help dialog
  - Only triggers when not in input/textarea/select/contentEditable elements
  - Help dialog with styled kbd elements showing all shortcuts
- Updated /src/components/layout/app-layout.tsx:
  - Imported and rendered CommandPalette and KeyboardShortcuts
  - Added Search button in header with ⌘K hint (hidden on mobile, replaced with icon-only)
  - Mobile: search icon button visible only on small screens
- Updated /src/components/views/dashboard-view.tsx:
  - KPI cards: grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 (was sm:grid-cols-2 lg:grid-cols-5)
  - Recent transactions: overflow-x-auto wrapper, hidden Category on <sm, hidden Description on <md
- Updated /src/components/views/margin-view.tsx:
  - Summary cards: grid-cols-2 sm:grid-cols-4 (was sm:grid-cols-2 lg:grid-cols-4)
  - Margin table: added min-w-[700px] for horizontal scroll
  - Alerts: flex-col sm:flex-row for mobile stacking
- Updated /src/components/views/transactions-view.tsx:
  - Header: flex-col sm:flex-row for mobile stacking
  - Create button: w-full sm:w-auto
  - Filter grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-5
  - Table: overflow-x-auto with min-w-[600px]
- Updated /src/components/views/projects-view.tsx:
  - Project cards: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
  - Project detail transactions: overflow-x-auto with min-w-[500px]
- Updated /src/components/views/cashflow-view.tsx:
  - Summary cards: grid-cols-2 lg:grid-cols-4
  - Payments table: overflow-x-auto with min-w-[700px]
- Updated /src/components/views/budgets-view.tsx:
  - Budgets table: overflow-x-auto with min-w-[700px]
- Updated /src/components/views/reports-view.tsx:
  - Added PDF export button (FileText icon) next to existing Excel and CSV exports for both Project P&L and Business P&L tabs
  - PDF export calls /api/reports/pnl/project/{id}/export?format=pdf and /api/reports/pnl/business/export?format=pdf
- Updated /src/components/layout/sidebar.tsx:
  - Nav items: py-3 min-h-[44px] (was py-2.5) for mobile touch targets >= 44px
- Lint passes clean
- App loads correctly in browser

Stage Summary:
- Global Search Command Palette (Cmd+K): searches across projects, counterparties, categories, transactions, users
- Keyboard Shortcuts: 1-5/D/T/P/R/M for navigation, ? for help, ⌘K for search
- Mobile Responsive: all views updated with proper grid breakpoints, overflow-x-auto tables, hidden columns on small screens
- PDF Export: added to both Project P&L and Business P&L reports
- Sidebar: improved touch targets for mobile (44px minimum)

---
Task ID: 4-backend
Agent: backend
Task: Implement Stage 4 Backend — PDF Reports, Auto-sync ZakupPro, Rate Limiting, Health Check, Structured Logging

Work Log:
- Installed pdfkit and @types/pdfkit dependencies
- Added serverExternalPackages: ["pdfkit"] to next.config.ts to fix pdfkit font path resolution in Next.js runtime
- Created structured logger (src/lib/logger.ts):
  - Levels: debug, info, warn, error with priority filtering
  - Production: JSON format; Development: human-readable with colors
  - Context object support; LOG_LEVEL env var support
- Created rate limiter (src/lib/rate-limit.ts):
  - In-memory per-IP rate limiting using Map
  - Default: 100 requests per 60 seconds per IP
  - X-Forwarded-For / X-Real-IP header support
  - Automatic cleanup of stale entries every 5 minutes
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
  - Logs to SyncLog
  - Returns sync results with triggeredBy: 'cron'
- Created cron 1c-watch API (src/app/api/cron/1c-watch/route.ts):
  - POST handler scans configured watch directory for new 1C .txt files
  - Protected by X-API-Key auth
  - Dual encoding support (Win-1251 / UTF-8)
  - Imports transactions with auto-classification
  - Updates ImportConfig.lastImportAt and creates SyncLog
- Added PDF export to project P&L route (format=pdf):
  - Uses pdfkit with DejaVu Sans font for Cyrillic support
  - Company header: "ООО ПРО Мебель"
  - Report title, project name/externalId, period
  - Revenue line, COGS breakdown with categories/subcategories
  - Total COGS, Gross Profit, Gross Margin %
  - Russian number formatting (space as thousands separator)
  - "Сформирован:" timestamp
- Added PDF export to business P&L route (format=pdf):
  - Full P&L table: Выручка, COGS, Валовая прибыль, Операционные расходы, EBIT, УСН 15%, Чистая прибыль
  - Project breakdown table: Код, Проект, Выручка, Себестоимость, Прибыль, Маржа
  - Totals row and "Сформирован:" timestamp
- Updated all API routes to use structured logger instead of console.log/console.error:
  - margin, dashboard, transactions, 1c-clientbank, import-config, 1c-auto, classification-rules, periods, sync/zakuppro
- Added auth to API routes that were missing it:
  - import-config GET — added getServerSession check
  - periods GET — added getServerSession check
- Lint passes clean, all endpoints tested and working

Stage Summary:
- 7 new features implemented:
  1. PDF P&L reports for both project and business (pdfkit with DejaVu Sans Cyrillic font)
  2. Cron API for ZakupPro auto-sync (X-API-Key protected)
  3. Cron API for 1C watch directory auto-import (X-API-Key protected)
  4. In-memory rate limiting middleware (100 req/60s per IP, skips auth/cron)
  5. Health check API (database status, version, uptime, memory)
  6. Structured logger (JSON in prod, colored in dev, context support)
  7. Auth added to previously unprotected GET endpoints (import-config, periods)


---
Task ID: 5-backend
Agent: backend
Task: Stage 5 — Security Hardening, Database Backups, PostgreSQL Migration, Production Config

Work Log:
- Created CSRF protection library (src/lib/csrf.ts):
  - generateCsrfToken() using crypto.randomUUID
  - validateCsrfToken() with timing-safe comparison (crypto.timingSafeEqual)
  - shouldSkipCsrf() and requiresCsrfValidation() helpers
  - Not enforced in middleware per task notes — SameSite=Lax cookies provide baseline CSRF protection
- Updated auth config (src/lib/auth.ts):
  - Added SameSite=Lax cookie configuration for all NextAuth cookies
  - Environment-conditional cookie names (__Secure-/__Host- prefixes only in production HTTPS)
  - csrfToken generated on login and stored in JWT for future use
- Updated NextAuth route (src/app/api/auth/[...nextauth]/route.ts):
  - Sets csrf-token cookie on successful credentials sign-in (for double-submit pattern)
- Created input sanitization library (src/lib/sanitize.ts):
  - sanitizeString(): strips HTML tags, normalizes unicode (NFC), trims whitespace, removes script handlers
  - sanitizeNumber(): ensures finite number, rounds to 2 decimal places
  - sanitizeDate(): validates YYYY-MM-DD/ISO 8601, sanity checks (2000-2100)
  - sanitizeUrl(): only allows http/https and relative URLs
  - sanitizeEnum(): whitelist-based enum validation
- Updated transactions API (src/app/api/transactions/route.ts):
  - POST: sanitizes description, externalId (sanitizeString), amount (sanitizeNumber), date (sanitizeDate)
- Updated projects API (src/app/api/projects/route.ts):
  - POST: sanitizes name, externalId (sanitizeString), startDate/endDate (sanitizeDate), contractAmount (sanitizeNumber)
- Updated middleware (src/middleware.ts):
  - Security headers on ALL responses: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy
  - Cache-Control: no-store for all API routes
  - Rate limiting preserved (API routes only, skips auth/cron)
  - Matcher updated to cover all routes (not just /api/*)
- Created database backup API (src/app/api/backup/route.ts):
  - POST: owner-only, detects SQLite vs PostgreSQL by DATABASE_URL, returns .db file or pg_dump output
  - GET: owner-only, returns backup capability info
  - Logs backup action in AuditLog
- Created backup scripts:
  - scripts/backup.sh: auto-detects DB type, timestamped gzip backup, keeps last 30
  - scripts/restore.sh: interactive restore with confirmation prompt
- Created PostgreSQL migration files:
  - prisma/schema.postgresql.prisma: complete schema with provider = "postgresql" (all 14 models)
  - scripts/migrate-to-pg.sh: 5-step migration script (switch schema → set URL → migrate → generate → seed)
- Updated next.config.ts:
  - poweredByHeader: false (removes X-Powered-By)
  - reactStrictMode: true
  - Security headers via headers() config
- Updated Dockerfile:
  - Added postgresql16-client for pg_dump backups
  - Added font-dejavu-sans for pdfkit Cyrillic support
  - Copy backup scripts, pdfkit data, system fonts
  - HEALTHCHECK instruction (wget /api/health every 30s)
- Updated docker-compose.yml:
  - Added backups volume and BACKUP_PATH environment variable
  - Added healthcheck for app container
  - Caddy depends_on app with condition: service_healthy
- Created .env.production.example: complete template with PostgreSQL, NextAuth, API keys, backup, logging
- Updated Caddyfile: production config with security headers (HSTS, -Server), gzip, static caching, API no-store
- Build passes: 42 API routes, lint clean

Stage Summary:
- Security headers on ALL responses (6 headers + CSP)
- SameSite=Lax cookies for CSRF protection (environment-conditional naming)
- Input sanitization on transaction and project creation
- Database backup API (SQLite file copy / PostgreSQL pg_dump)
- Backup and restore shell scripts (auto-cleanup, keeps 30)
- PostgreSQL schema and migration script ready
- Production Next.js config (no X-Powered-By, strict mode, standalone)
- Production Dockerfile (pg_dump, fonts, healthcheck)
- Production docker-compose (backup volume, healthcheck, Caddy health dependency)
- Production Caddyfile (HSTS, gzip, static caching, security headers)
- .env.production.example template
