const prisma = require('../utils/prisma');

// Get notifications for current user
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    res.json({ notifications, total, unreadCount, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: '알림을 찾을 수 없습니다' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: '권한이 없습니다' });

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all as read
const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: '알림을 찾을 수 없습니다' });
    if (notification.userId !== req.user.id) return res.status(403).json({ error: '권한이 없습니다' });

    await prisma.notification.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper: Create notification (used by other controllers)
const createNotification = async ({ tenantId, userId, type, title, message, data }) => {
  try {
    const notification = await prisma.notification.create({
      data: { tenantId, userId, type, title, message, data: data ? JSON.stringify(data) : null }
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
};

// Helper: Notify all admins in a tenant
const notifyTenantAdmins = async ({ tenantId, type, title, message, data }) => {
  try {
    const admins = await prisma.user.findMany({
      where: { tenantId, role: { in: ['TENANT_ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true }
    });

    const notifications = await Promise.all(
      admins.map(admin => createNotification({ tenantId, userId: admin.id, type, title, message, data }))
    );
    return notifications.filter(Boolean);
  } catch (error) {
    console.error('Failed to notify admins:', error.message);
    return [];
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  notifyTenantAdmins,
};
