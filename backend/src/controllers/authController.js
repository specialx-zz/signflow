const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { validatePassword } = require('../utils/password');
const {
  recordFailedLogin,
  recordSuccessfulLogin,
} = require('../middleware/loginLimiter');
const { setTenantPlan } = require('../middleware/tenantRateLimit');
const { logger } = require('../utils/logger');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user || !user.isActive) {
      recordFailedLogin(ip, email);
      logger.warn('Login failed: invalid credentials', { email, ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordFailedLogin(ip, email);
      logger.warn('Login failed: wrong password', { email, ip, userId: user.id });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 로그인 성공 → 잠금 카운터 초기화
    recordSuccessfulLogin(ip, email);

    // Map old 'ADMIN' role to 'TENANT_ADMIN' for backward compatibility
    const effectiveRole = user.role === 'ADMIN' ? 'TENANT_ADMIN' : user.role;

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign(
      { userId: user.id, role: effectiveRole, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 테넌트 Rate limit 플랜 캐싱
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: user.tenantId },
        select: { plan: true },
      });
      if (subscription) {
        setTenantPlan(user.tenantId, subscription.plan);
      }
    } catch (_) { /* rate limit 캐시 실패는 무시 */ }

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId || 'default-tenant',
        userId: user.id,
        action: 'LOGIN',
        ipAddress: ip,
        details: JSON.stringify({ userAgent: req.headers['user-agent']?.substring(0, 200) }),
      },
    });

    logger.info('Login successful', { userId: user.id, email, tenantId: user.tenantId });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: effectiveRole,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name || null,
      },
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Login failed' });
  }
};

const logout = async (req, res) => {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId || 'default-tenant',
        userId: req.user.id,
        action: 'LOGOUT',
        ipAddress: req.ip,
      },
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      ...user,
      tenantName: user.tenant?.name || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

/**
 * PUT /api/auth/change-password
 * 비밀번호 변경 (로그인 사용자)
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }

    // 비밀번호 정책 검증
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({
        error: '비밀번호 정책을 충족하지 않습니다.',
        details: validation.errors,
        code: 'WEAK_PASSWORD',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    logger.info('Password changed', { userId: req.user.id });

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    logger.error('Change password error', { error });
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
};

module.exports = { login, logout, getMe, changePassword };
