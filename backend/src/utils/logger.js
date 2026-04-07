/**
 * logger.js — 구조화 로깅 유틸리티
 *
 * 경량 구조화 로거 (Winston/Pino 없이 동작)
 * - JSON 포맷 (프로덕션) / 컬러 텍스트 (개발)
 * - 로그 레벨: error, warn, info, debug
 * - 컨텍스트 (tenantId, userId, requestId) 자동 포함
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * 로그 출력
 */
function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > CURRENT_LEVEL) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  // 에러 객체 직렬화
  if (meta.error instanceof Error) {
    entry.error = {
      name: meta.error.name,
      message: meta.error.message,
      stack: IS_PRODUCTION ? undefined : meta.error.stack,
    };
  }

  if (IS_PRODUCTION) {
    // JSON 라인 포맷 (ELK, CloudWatch 호환)
    const output = level === 'error' ? process.stderr : process.stdout;
    output.write(JSON.stringify(entry) + '\n');
  } else {
    // 개발 모드: 컬러 출력
    const colors = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    const metaStr = Object.keys(meta).length > 0
      ? ' ' + JSON.stringify(meta, null, 0)
      : '';
    console.log(`${color}[${level.toUpperCase()}]${reset} ${message}${metaStr}`);
  }
}

const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn', msg, meta),
  info:  (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

/**
 * Express 요청 로깅 미들웨어 (morgan 대체)
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.headers['x-forwarded-for'],
    };

    if (req.user) {
      meta.userId = req.user.id;
      meta.tenantId = req.user.tenantId;
    }

    if (res.statusCode >= 500) {
      logger.error('Request error', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', meta);
    } else {
      logger.info('Request', meta);
    }
  });

  next();
}

module.exports = { logger, requestLogger };
