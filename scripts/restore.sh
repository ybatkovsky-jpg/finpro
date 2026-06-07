#!/bin/bash
# FinPro Database Restore Script
# Usage: ./scripts/restore.sh <backup_file>

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will REPLACE the current database!"
read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

if echo "$DATABASE_URL" | grep -q "^postgresql"; then
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
  echo "PostgreSQL restore complete."
elif echo "$DATABASE_URL" | grep -q "^file:"; then
  DB_PATH=$(echo "$DATABASE_URL" | sed 's|^file:||')
  gunzip -c "$BACKUP_FILE" > "$DB_PATH"
  echo "SQLite restore complete."
else
  echo "Error: Cannot determine database type from DATABASE_URL"
  echo "Expected: postgresql://... or file:..."
  exit 1
fi
