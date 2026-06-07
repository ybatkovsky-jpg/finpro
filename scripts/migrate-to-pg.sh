#!/bin/bash
# FinPro — Migrate from SQLite to PostgreSQL
# Usage: ./scripts/migrate-to-pg.sh <DATABASE_URL>

set -e

PG_URL="${1:?Usage: $0 <postgresql://user:pass@host:5432/db>}"

echo "=== FinPro SQLite → PostgreSQL Migration ==="
echo "Target: $PG_URL"
echo ""

# 1. Switch to PostgreSQL schema
echo "[1/5] Switching Prisma schema to PostgreSQL..."
cp prisma/schema.prisma prisma/schema.sqlite.backup.prisma
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# 2. Set DATABASE_URL
echo "[2/5] Setting DATABASE_URL..."
export DATABASE_URL="$PG_URL"

# 3. Run Prisma migrate
echo "[3/5] Running Prisma migration..."
npx prisma migrate dev --name init_postgresql --skip-generate

# 4. Generate Prisma client
echo "[4/5] Generating Prisma client..."
npx prisma generate

# 5. Seed the database
echo "[5/5] Seeding database..."
bunx tsx prisma/seed.ts

echo ""
echo "=== Migration Complete ==="
echo "PostgreSQL is ready. Update your .env with:"
echo "DATABASE_URL=$PG_URL"
echo ""
echo "To revert to SQLite: cp prisma/schema.sqlite.backup.prisma prisma/schema.prisma"
