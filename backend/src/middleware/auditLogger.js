/**
 * auditLogger.js — 자동 감사 로그 미들웨어
 *
 * CUD(Create/Update/Delete) 작업을 자동으로 AuditLog에 기록
 * - POST (create), PUT/PATCH (update), DELETE 요청만 대상
 * - GET 요청은 제외
 * - 응답 성공(2xx) 시에만 기록
 */

const prisma = require('../utils/prisma');

// 요청 경로에서 리소스 타입 추출
function extractTarget(method, path) {
  // /api/content/uuid → Content
  // /api/devices/uuid → Device
  const segments = path.replace(/^\/api\//, '').split('/');
  const resource = segments[0] || 'unknown';

  // 리소스 이름 매핑
  const RESOURCE_MAP = {
    content: 'Content',
    devices: 'Device',
    playlists: 'Playlist',
    schedules: 'Schedule',
    users: 'User',
    tenants: 'Tenant',
    stores: 'Store',
    layouts: 'Layout',
    subscriptions: 'Subscription',
    settings: 'Settings',
  };

  const resourceName = RESOURCE_MAP[resource] || resource;
  const resourceId = segments[1] && segments[1].length > 8 ? segments[1] : null;

  return resourceId ? `${resourceName}:${resourceId}` : resourceName;
}

// HTTP 메서드 → 감사 액션
function methodToAction(method, path) {
  const pathLower = path.toLowerCase();

  // 특수 경로 매핑
  if (pathLower.includes('/login')) return 'LOGIN';
  if (pathLower.includes('/logout')) return 'LOGOUT';
  if (pathLower.includes('/register')) return 'REGISTER';
  if (pathLower.includes('/control')) return 'CONTROL';
  if (pathLower.includes('/deploy')) return 'DEPLOY';
  if (pathLower.includes('/screenshot')) return 'SCREENSHOT';

  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return method;
  }
}

/**
 * 감사 로그 자동 기록 미들웨어
 * - authenticate 미들웨어 이후에 사용
 */
const auditLogger = (req, res, next) => {
  // GET 요청은 무시
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // 원래 res.json을 래핑하여 응답 성공 시 감사 로그 기록
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // 성공 응답인 경우에만 기록 (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const action = methodToAction(req.method, req.originalUrl || req.url);
      const target = extractTarget(req.method, req.originalUrl || req.url);

      // 비동기로 기록 (응답 지연 방지)
      setImmediate(async () => {
        try {
          await prisma.auditLog.create({
            data: {
              tenantId: req.tenantId || req.user.tenantId || 'default-tenant',
              userId: req.user.id,
              action,
              target,
              details: JSON.stringify({
                method: req.method,
                path: req.originalUrl || req.url,
                statusCode: res.statusCode,
                ip: req.ip || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent']?.substring(0, 200),
              }),
              ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
            },
          });
        } catch (err) {
          // 감사 로그 실패가 메인 로직에 영향을 주면 안됨
          console.error('[AuditLog] Failed to write audit log:', err.message);
        }
      });
    }

    return originalJson(body);
  };

  next();
};

module.exports = { auditLogger };
