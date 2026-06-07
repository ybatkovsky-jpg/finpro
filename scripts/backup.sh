#!/bin/bash
# FinPro Database Backup Script
# Usage: ./scripts/backup.sh [output_dir]
# Designed for cron: 0 2 * * * /app/scripts/backup.sh /backups

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="finpro_backup_${TIMESTAMP}"

mkdir -p "$OUTPUT_DIR"

if echo "$DATABASE_URL" | grep -q "^postgresql"; then
  pg_dump "$DATABASE_URL" > "${OUTPUT_DIR}/${FILENAME}.sql"
  gzip "${OUTPUT_DIR}/${FILENAME}.sql"
  echo "PostgreSQL backup: ${OUTPUT_DIR}/${FILENAME}.sql.gz"
elif echo "$DATABASE_URL" | grep -q "^file:"; then
  DB_PATH=$(echo "$DATABASE_URL" | sed 's|^file:||')
  cp "$DB_PATH" "${OUTPUT_DIR}/${FILENAME}.db"
  gzip "${OUTPUT_DIR}/${FILENAME}.db"
  echo "SQLite backup: ${OUTPUT_DIR}/${FILENAME}.db.gz"
else
  echo "Error: Cannot determine database type from DATABASE_URL"
  echo "Expected: postgresql://... or file:..."
  exit 1
fi

# Keep only last 30 backups
ls -t "${OUTPUT_DIR}"/finpro_backup_*.gz 2>/dev/null | tail -n +31 | xargs -r rm
echo "Cleanup: keeping last 30 backups"
