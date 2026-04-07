#!/bin/bash
# SignFlow Deploy Script
# Usage: ./scripts/deploy.sh [environment]

set -e

ENV="${1:-staging}"

echo "🚀 SignFlow Deploy - ${ENV}"
echo "=========================="

# 1. Pre-deploy checks
echo "🔍 Running pre-deploy checks..."

# Check if tests pass
echo "   Running backend tests..."
cd backend && npm test && cd ..
echo "   ✅ Backend tests passed"

echo "   Running frontend tests..."
cd frontend && npm test && cd ..
echo "   ✅ Frontend tests passed"

# 2. Build
echo "📦 Building..."
cd frontend && npm run build && cd ..
echo "   ✅ Frontend built"

# 3. Backup current state
echo "🗄️  Creating pre-deploy backup..."
./scripts/backup.sh ./backups

# 4. Database migration
echo "🔄 Running database migrations..."
cd backend && npx prisma db push && cd ..
echo "   ✅ Database up to date"

# 5. Restart
if [ "$ENV" = "production" ]; then
  echo "🐳 Restarting Docker services..."
  docker-compose down
  docker-compose up -d --build
  echo "   ✅ Docker services restarted"
else
  echo "🔄 Restarting with PM2..."
  pm2 restart signflow-backend 2>/dev/null || pm2 start backend/src/app.js --name signflow-backend
  echo "   ✅ Backend restarted"
fi

# 6. Health check
echo "🏥 Running health check..."
sleep 5
HEALTH=$(curl -s http://localhost:3001/api/health)
echo "   ${HEALTH}"

echo ""
echo "✅ Deploy to ${ENV} complete!"
