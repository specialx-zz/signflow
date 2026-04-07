const prisma = require('../utils/prisma');
const os = require('os');

/**
 * Basic health check - used by load balancers and Docker HEALTHCHECK
 */
async function basicHealth(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

/**
 * Detailed health check - includes DB, memory, uptime
 * Only accessible in non-production or with admin auth
 */
async function detailedHealth(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  // Database check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'ok',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = {
      status: 'error',
      message: error.message,
    };
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'ok' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
  };

  // System info
  health.checks.system = {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
    freeMemory: Math.round(os.freemem() / 1024 / 1024) + 'MB',
    loadAvg: os.loadavg(),
  };

  // Socket.IO connections (if available)
  if (req.io) {
    try {
      const sockets = await req.io.fetchSockets();
      health.checks.websocket = {
        status: 'ok',
        connections: sockets.length,
      };
    } catch (e) {
      health.checks.websocket = {
        status: 'ok',
        connections: 'unknown',
      };
    }
  }

  // Disk usage for uploads
  const fs = require('fs');
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  try {
    if (fs.existsSync(uploadDir)) {
      health.checks.storage = {
        status: 'ok',
        uploadDir: uploadDir,
      };
    } else {
      health.checks.storage = {
        status: 'warning',
        message: 'Upload directory not found',
      };
    }
  } catch (e) {
    health.checks.storage = { status: 'error', message: e.message };
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
}

module.exports = { basicHealth, detailedHealth };
