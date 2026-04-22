#!/bin/bash
# VueSign Backup Script
# Usage: ./scripts/backup.sh [backup_dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="vuesign_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo "🗄️  VueSign Backup - ${TIMESTAMP}"
echo "================================"

# Create backup directory
mkdir -p "${BACKUP_PATH}"

# 1. Database backup
echo "📦 Backing up database..."
if [ -f "backend/prisma/dev.db" ]; then
  cp backend/prisma/dev.db "${BACKUP_PATH}/database.db"
  echo "   ✅ SQLite database backed up"
fi

# For PostgreSQL (if configured)
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "postgresql"; then
  pg_dump "$DATABASE_URL" > "${BACKUP_PATH}/database.sql"
  echo "   ✅ PostgreSQL database backed up"
fi

# 2. Upload files backup
echo "📁 Backing up uploads..."
if [ -d "backend/uploads" ]; then
  tar -czf "${BACKUP_PATH}/uploads.tar.gz" -C backend uploads/
  echo "   ✅ Upload files backed up"
else
  echo "   ⚠️  No uploads directory found"
fi

# 3. Configuration backup
echo "⚙️  Backing up configuration..."
if [ -f "backend/.env" ]; then
  cp backend/.env "${BACKUP_PATH}/env.backup"
  echo "   ✅ Environment config backed up"
fi

if [ -f "docker-compose.yml" ]; then
  cp docker-compose.yml "${BACKUP_PATH}/docker-compose.yml"
fi

# 4. Create backup manifest
echo "📋 Creating manifest..."
cat > "${BACKUP_PATH}/manifest.json" << EOF
{
  "version": "2.0.0",
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -Iseconds)",
  "contents": {
    "database": $([ -f "${BACKUP_PATH}/database.db" ] && echo "true" || echo "false"),
    "uploads": $([ -f "${BACKUP_PATH}/uploads.tar.gz" ] && echo "true" || echo "false"),
    "config": $([ -f "${BACKUP_PATH}/env.backup" ] && echo "true" || echo "false")
  }
}
EOF

# 5. Calculate total size
TOTAL_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
echo ""
echo "✅ Backup complete!"
echo "   Location: ${BACKUP_PATH}"
echo "   Size: ${TOTAL_SIZE}"

# 6. Cleanup old backups (keep last 30)
BACKUP_COUNT=$(ls -d "${BACKUP_DIR}"/vuesign_backup_* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - 30))
  echo ""
  echo "🧹 Cleaning up ${REMOVE_COUNT} old backup(s)..."
  ls -dt "${BACKUP_DIR}"/vuesign_backup_* | tail -n "${REMOVE_COUNT}" | xargs rm -rf
fi
