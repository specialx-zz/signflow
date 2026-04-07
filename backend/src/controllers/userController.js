const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { validatePassword } = require('../utils/password');

const ROLE_HIERARCHY = {
  'VIEWER': 10,
  'USER': 20,
  'STORE_MANAGER': 30,
  'TENANT_ADMIN': 40,
  'SUPER_ADMIN': 50,
};
const VALID_ROLES = Object.keys(ROLE_HIERARCHY);

const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    // SUPER_ADMIN sees all users; others see only their tenant
    if (req.user.role !== 'SUPER_ADMIN' && req.tenantId) {
      where.tenantId = req.tenantId;
    }
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, username: true, email: true, role: true,
          isActive: true, lastLogin: true, createdAt: true,
          tenant: { select: { name: true } }
        }
      }),
      prisma.user.count({ where })
    ]);

    const mappedItems = items.map(user => ({
      ...user,
      tenantName: user.tenant?.name,
      tenant: undefined
    }));

    res.json({
      items: mappedItems,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, email: true, role: true,
        isActive: true, lastLogin: true, createdAt: true, updatedAt: true, tenantId: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (req.user.role !== 'SUPER_ADMIN' && req.tenantId && user.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // 비밀번호 정책 검증
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({
        error: '비밀번호 정책을 충족하지 않습니다.',
        details: pwCheck.errors,
        code: 'WEAK_PASSWORD',
      });
    }

    // Role whitelist: requester cannot assign a role >= their own
    const requestedRole = role || 'USER';
    if (!VALID_ROLES.includes(requestedRole)) {
      return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    }
    const requestorLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const targetLevel = ROLE_HIERARCHY[requestedRole] || 0;
    if (targetLevel >= requestorLevel) {
      return res.status(403).json({ error: '자신보다 높거나 같은 역할을 부여할 수 없습니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        username,
        email,
        password: hashedPassword,
        role: requestedRole,
        tenantId: req.tenantId || req.user.tenantId
      },
      select: {
        id: true, username: true, email: true, role: true, isActive: true, createdAt: true
      }
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { username, email, password, role, isActive } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (req.user.role !== 'SUPER_ADMIN' && req.tenantId && user.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
      }
      const requestorLevel = ROLE_HIERARCHY[req.user.role] || 0;
      const targetLevel = ROLE_HIERARCHY[role] || 0;
      if (targetLevel >= requestorLevel) {
        return res.status(403).json({ error: '자신보다 높거나 같은 역할을 부여할 수 없습니다.' });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      const pwCheck = validatePassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({
          error: '비밀번호 정책을 충족하지 않습니다.',
          details: pwCheck.errors,
          code: 'WEAK_PASSWORD',
        });
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true, username: true, email: true, role: true, isActive: true, updatedAt: true
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (req.user.role !== 'SUPER_ADMIN' && req.tenantId && user.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
