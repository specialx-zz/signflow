require('dotenv').config();

// Environment validation
if (process.env.NODE_ENV !== 'test') {
  const { validateEnv } = require('./utils/envValidator');
  const { errors, warnings } = validateEnv();
  warnings.forEach(w => console.warn(`⚠️  ${w}`));
  if (errors.length > 0) {
    errors.forEach(e => console.error(`❌ ${e}`));
    if (process.env.NODE_ENV === 'production') {
      console.error('Fatal: Environment validation failed. Exiting.');
      process.exit(1);
    }
  }
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');

const tenantRoutes = require('./routes/tenants');
const storeRoutes = require('./routes/stores');
const subscriptionRoutes = require('./routes/subscriptions');
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const playlistRoutes = require('./routes/playlists');
const scheduleRoutes = require('./routes/schedules');
const deviceRoutes = require('./routes/devices');
const userRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const settingsRoutes = require('./routes/settings');
const layoutRoutes = require('./routes/layouts');
const emergencyRoutes = require('./routes/emergency');
const sharedContentRoutes = require('./routes/sharedContent');
const approvalRoutes = require('./routes/approvals');
const notificationRoutes = require('./routes/notifications');
const templateRoutes = require('./routes/templates');
const webhookRoutes = require('./routes/webhooks');
const canvasRoutes = require('./routes/canvas');
const channelRoutes = require('./routes/channels');
const tagPlaybackRoutes = require('./routes/tagPlayback');
const screenWallRoutes = require('./routes/screenWall');
const fontRoutes = require('./routes/fonts');
const weatherRoutes = require('./routes/weather');

const { setupSocketIO } = require('./utils/socket');
const { logger, requestLogger } = require('./utils/logger');
const { auditLogger } = require('./middleware/auditLogger');
const { tenantRateLimit } = require('./middleware/tenantRateLimit');

const app = express();
const server = http.createServer(app);

// Allowed origins: comma-separated list in ALLOWED_ORIGINS env var.
// Falls back to localhost defaults for development.
// 5173=admin frontend, 5174=Electron player dev server.
// 'file://','null','app://' patterns cover Electron/Capacitor production builds.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'file://',
      'null',
    ];

const corsOriginFn = (origin, callback) => {
  // Allow requests with no Origin header (same-origin, server-to-server, curl)
  if (!origin) return callback(null, true);
  // Exact match
  if (allowedOrigins.includes(origin)) return callback(null, true);
  // Prefix match for Electron file:// and app:// schemes
  // e.g. "file:///C:/..." should match "file://" entry
  if (allowedOrigins.some(o => o.endsWith('://') && origin.startsWith(o))) {
    return callback(null, true);
  }
  // Deny cleanly — return false instead of throwing so the response is a
  // standard CORS failure rather than a 500 Internal Server Error.
  console.warn(`[CORS] rejected origin: ${origin}`);
  callback(null, false);
};

const io = new Server(server, {
  cors: {
    origin: corsOriginFn,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '..', 'uploads');
['images', 'videos', 'audio', 'documents', 'thumbnails'].forEach(dir => {
  fs.ensureDirSync(path.join(uploadDir, dir));
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: corsOriginFn,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Logging — 프로덕션: 구조화 JSON, 개발: morgan dev
if (process.env.NODE_ENV === 'production') {
  app.use(requestLogger);
} else if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(uploadDir));

// Attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Audit logging + tenant rate limit (CUD 작업 자동 감사 기록)
app.use('/api', auditLogger);

// Routes
app.use('/api/tenants', tenantRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/layouts', layoutRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/shared-content', sharedContentRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/tag-playback', tagPlaybackRoutes);
app.use('/api/screen-wall', screenWallRoutes);
app.use('/api/fonts', fontRoutes);
app.use('/api/weather', weatherRoutes);

// Health check (also accessible at /api/health for player ping)
const { basicHealth, detailedHealth } = require('./controllers/healthController');
app.get('/health', basicHealth);
app.get('/api/health', basicHealth);
app.get('/api/health/detailed', detailedHealth);

// Screenshots static serving
const screenshotDir = path.join(__dirname, '..', 'uploads', 'screenshots');
fs.ensureDirSync(screenshotDir);
app.use('/uploads/screenshots', express.static(screenshotDir));

// API Documentation
if (process.env.NODE_ENV !== 'production') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpecs = require('./utils/swagger');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    customSiteTitle: 'VueSign API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Setup Socket.IO
setupSocketIO(io);

// V4 Phase 11: 콘텐츠 생애주기 cron job
if (process.env.NODE_ENV !== 'test') {
  const { startContentLifecycleCron } = require('./services/contentLifecycleService');
  startContentLifecycleCron();
}

const PORT = process.env.PORT || 3001;

// Don't start listening in test mode — supertest manages the server
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`VueSign Backend running on port ${PORT}`);
  });
}

module.exports = { app, server, io };
