#!/bin/bash
# VueSign Restore Script
# Usage: ./scripts/restore.sh <backup_path>

set -e

BACKUP_PATH="${1}"

if [ -z "$BACKUP_PATH" ]; then
  echo "Usage: ./scripts/restore.sh <backup_path>"
  echo ""
  echo "Available backups:"
  ls -d backups/vuesign_backup_* 2>/dev/null || echo "  No backups found in ./backups/"
  exit 1
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "❌ Backup not found: ${BACKUP_PATH}"
  exit 1
fi

echo "🔄 VueSign Restore"
echo "==================="
echo "   From: ${BACKUP_PATH}"

# Read manifest
if [ -f "${BACKUP_PATH}/manifest.json" ]; then
  echo "   Manifest found"
  cat "${BACKUP_PATH}/manifest.json"
  echo ""
fi

# Confirm
read -p "⚠️  This will overwrite current data. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# 1. Stop the server if running
echo "🛑 Stopping server..."
pkill -f "node src/app.js" 2>/dev/null || true
sleep 2

# 2. Restore database
if [ -f "${BACKUP_PATH}/database.db" ]; then
  echo "📦 Restoring database..."
  cp "${BACKUP_PATH}/database.db" backend/prisma/dev.db
  echo "   ✅ SQLite database restored"
fi

if [ -f "${BACKUP_PATH}/database.sql" ] && [ -n "$DATABASE_URL" ]; then
  echo "📦 Restoring PostgreSQL database..."
  psql "$DATABASE_URL" < "${BACKUP_PATH}/database.sql"
  echo "   ✅ PostgreSQL database restored"
fi

# 3. Restore uploads
if [ -f "${BACKUP_PATH}/uploads.tar.gz" ]; then
  echo "📁 Restoring uploads..."
  rm -rf backend/uploads
  tar -xzf "${BACKUP_PATH}/uploads.tar.gz" -C backend/
  echo "   ✅ Upload files restored"
fi

# 4. Restore config (optional)
if [ -f "${BACKUP_PATH}/env.backup" ]; then
  echo "⚙️  Config backup available at: ${BACKUP_PATH}/env.backup"
  echo "   (Not auto-restoring - review and copy manually if needed)"
fi

echo ""
echo "✅ Restore complete!"
echo "   Restart the server with: cd backend && npm start"
