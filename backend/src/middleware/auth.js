const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

// ─── 역할 계층 ────────────────────────────────────
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 50,
  TENANT_ADMIN: 40,
  STORE_MANAGER: 30,
  USER: 20,
  VIEWER: 10,
  // 하위 호환
  ADMIN: 40,
};

/**
 * 역할 권한 확인 — userRole이 requiredRole 이상인지 체크
 */
function hasRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

/**
 * JWT 인증 미들웨어
 * - req.user에 { id, username, email, role, tenantId } 설정
 */
const authenticate = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tenantId: true,
        storeId: true,
        isActive: true,
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
};

/**
 * Optional JWT 인증 미들웨어
 * - Authorization 헤더가 있으면 검증 후 req.user/req.tenantId 설정
 * - 없거나 유효하지 않으면 그냥 통과 (req.user 는 undefined)
 * - 인증된 사용자와 플레이어(kiosk) 양쪽에서 접근 가능한 라우트용
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    if (!process.env.JWT_SECRET) {
      return next();
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      // 토큰이 있지만 유효하지 않은 경우에도 그냥 통과
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tenantId: true,
        storeId: true,
        isActive: true,
      }
    });

    if (user && user.isActive) {
      req.user = user;
      // tenantContext 와 동일한 규칙으로 req.tenantId 설정
      if (user.role === 'SUPER_ADMIN') {
        const headerTenantId = req.headers['x-tenant-id'];
        req.tenantId = headerTenantId || null; // null = 전체 접근
      } else if (user.tenantId) {
        req.tenantId = user.tenantId;
      }
    }
    next();
  } catch (error) {
    // 옵셔널이므로 에러가 나더라도 무조건 통과
    next();
  }
};

/**
 * 역할 기반 인가 미들웨어
 * - 계층 기반: authorize('USER')이면 USER 이상 (STORE_MANAGER, TENANT_ADMIN, SUPER_ADMIN) 모두 통과
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // roles 중 하나라도 충족하면 통과 (OR 조건)
    const allowed = roles.some(role => hasRole(req.user.role, role));
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * 슈퍼어드민 전용 미들웨어
 */
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate, authorize, superAdminOnly, hasRole, ROLE_HIERARCHY };
