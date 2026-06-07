# ============================
# FinPro — Production Dockerfile
# Next.js 16 standalone + Prisma
# ============================

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lock* package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm i; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install runtime dependencies: postgresql-client for pg_dump backups
RUN echo "http://dl-cdn.alpinelinux.org/alpine/v3.21/community" >> /etc/apk/repositories && apk add --no-cache postgresql16-client font-dejavu

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy bcryptjs (not included in standalone trace)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy backup scripts
COPY --from=builder /app/scripts ./scripts

# Copy font files for pdfkit (DejaVu Sans for Cyrillic support)
COPY --from=builder /app/node_modules/pdfkit/js/data ./node_modules/pdfkit/js/data
# System fonts for pdfkit fallback
RUN mkdir -p /app/fonts && \
    cp /usr/share/fonts/dejavu/DejaVuSans*.ttf /app/fonts/ 2>/dev/null || true

# Create directories
RUN mkdir -p /app/upload /app/backups /app/1c-import && \
    chown -R nextjs:nodejs /app/upload /app/backups /app/1c-import /app/fonts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
