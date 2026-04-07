const prisma = require('../utils/prisma');

const getDashboardStats = async (req, res) => {
  try {
    const contentWhere = { isActive: true };
    const deviceWhere = { isActive: true };
    const scheduleWhere = { isActive: true, status: 'ACTIVE' };
    const onlineDeviceWhere = { isActive: true, status: 'ONLINE' };
    if (req.tenantId) {
      contentWhere.tenantId = req.tenantId;
      deviceWhere.tenantId = req.tenantId;
      scheduleWhere.tenantId = req.tenantId;
      onlineDeviceWhere.tenantId = req.tenantId;
    }

    const [
      contentCount,
      deviceCount,
      scheduleCount,
      onlineDeviceCount,
      recentContent,
      deviceStatusCounts,
      storageUsed
    ] = await Promise.all([
      prisma.content.count({ where: contentWhere }),
      prisma.device.count({ where: deviceWhere }),
      prisma.schedule.count({ where: scheduleWhere }),
      prisma.device.count({ where: onlineDeviceWhere }),
      prisma.content.findMany({
        where: contentWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { creator: { select: { username: true } } }
      }),
      prisma.device.groupBy({
        by: ['status'],
        _count: { status: true },
        where: deviceWhere
      }),
      prisma.content.aggregate({
        _sum: { size: true },
        where: contentWhere
      })
    ]);

    // Get play count trend for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const playStatsWhere = {
      type: 'PLAY_COUNT',
      date: { gte: sevenDaysAgo }
    };
    if (req.tenantId) playStatsWhere.tenantId = req.tenantId;
    const playStats = await prisma.statistics.findMany({
      where: playStatsWhere,
      orderBy: { date: 'asc' }
    });

    // Group by date
    const playTrend = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      playTrend[key] = 0;
    }

    playStats.forEach(stat => {
      const key = stat.date.toISOString().split('T')[0];
      if (playTrend[key] !== undefined) {
        playTrend[key] += stat.value;
      }
    });

    const statusMap = {};
    deviceStatusCounts.forEach(s => {
      statusMap[s.status] = s._count.status;
    });

    res.json({
      stats: {
        content: contentCount,
        devices: deviceCount,
        activeSchedules: scheduleCount,
        onlineDevices: onlineDeviceCount,
        storageUsed: storageUsed._sum.size || 0
      },
      deviceStatus: {
        online: statusMap['ONLINE'] || 0,
        offline: statusMap['OFFLINE'] || 0,
        warning: statusMap['WARNING'] || 0
      },
      recentContent,
      playTrend: Object.entries(playTrend).map(([date, count]) => ({ date, count }))
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

const getContentStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const contentStatsWhere = { isActive: true };
    const playCountWhere = { type: 'PLAY_COUNT', date: { gte: startDate } };
    if (req.tenantId) {
      contentStatsWhere.tenantId = req.tenantId;
      playCountWhere.tenantId = req.tenantId;
    }

    const [typeStats, topContent, totalPlays] = await Promise.all([
      prisma.content.groupBy({
        by: ['type'],
        _count: { type: true },
        where: contentStatsWhere
      }),
      prisma.statistics.groupBy({
        by: ['contentId'],
        _sum: { value: true },
        where: playCountWhere,
        orderBy: { _sum: { value: 'desc' } },
        take: 10
      }),
      prisma.statistics.aggregate({
        _sum: { value: true },
        where: playCountWhere
      })
    ]);

    // Get content details for top content — single query instead of N+1
    const topContentIds = topContent.map(s => s.contentId).filter(Boolean);
    const topContentDetails = topContentIds.length > 0
      ? await prisma.content.findMany({
          where: { id: { in: topContentIds } },
          select: { id: true, name: true, type: true }
        })
      : [];
    const contentMap = new Map(topContentDetails.map(c => [c.id, c]));
    const topContentWithDetails = topContent
      .map(stat => {
        const content = contentMap.get(stat.contentId);
        if (!content) return null;
        return { ...content, playCount: stat._sum.value };
      })
      .filter(Boolean);

    res.json({
      typeDistribution: typeStats.map(s => ({ type: s.type, count: s._count.type })),
      topContent: topContentWithDetails.filter(c => c.id),
      totalPlays: totalPlays._sum.value || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get content stats' });
  }
};

const getDeviceStats = async (req, res) => {
  try {
    const devStatsWhere = { isActive: true };
    if (req.tenantId) devStatsWhere.tenantId = req.tenantId;
    const devices = await prisma.device.findMany({
      where: devStatsWhere,
      select: {
        id: true, name: true, status: true, lastSeen: true,
        group: { select: { name: true } }
      }
    });

    const statusCounts = {
      ONLINE: 0, OFFLINE: 0, WARNING: 0
    };

    devices.forEach(d => {
      if (statusCounts[d.status] !== undefined) {
        statusCounts[d.status]++;
      }
    });

    res.json({
      devices,
      statusCounts,
      totalDevices: devices.length,
      onlineRate: devices.length > 0 ? ((statusCounts.ONLINE / devices.length) * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device stats' });
  }
};

// Daily report data
const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const tenantWhere = req.tenantId ? { tenantId: req.tenantId } : {};

    const [
      contentCount,
      deviceCount,
      activeDevices,
      playlistCount,
      scheduleCount,
      newContent,
      playStats,
    ] = await Promise.all([
      prisma.content.count({ where: { ...tenantWhere, isActive: true } }),
      prisma.device.count({ where: tenantWhere }),
      prisma.device.count({ where: { ...tenantWhere, status: 'ONLINE' } }),
      prisma.playlist.count({ where: { ...tenantWhere, isActive: true } }),
      prisma.schedule.count({ where: { ...tenantWhere, status: 'ACTIVE' } }),
      prisma.content.count({
        where: { ...tenantWhere, createdAt: { gte: startOfDay, lte: endOfDay } }
      }),
      prisma.statistics.findMany({
        where: { ...tenantWhere, date: { gte: startOfDay, lte: endOfDay }, type: 'PLAY' },
      }),
    ]);

    const totalPlays = playStats.length;
    const totalDuration = playStats.reduce((sum, s) => sum + (s.value || 0), 0);

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      summary: {
        totalContent: contentCount,
        totalDevices: deviceCount,
        activeDevices,
        deviceUptime: deviceCount > 0 ? Math.round((activeDevices / deviceCount) * 100) : 0,
        totalPlaylists: playlistCount,
        activeSchedules: scheduleCount,
        newContentToday: newContent,
        totalPlays,
        totalPlayDuration: totalDuration,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Weekly trend data — 21개 개별 쿼리 → 3개 범위 쿼리 + 인메모리 집계
const getWeeklyTrend = async (req, res) => {
  try {
    const tenantWhere = req.tenantId ? { tenantId: req.tenantId } : {};

    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 6);
    rangeStart.setHours(0, 0, 0, 0);

    // 3개의 단일 범위 쿼리
    const [statsRows, contentRows, deviceRows] = await Promise.all([
      prisma.statistics.findMany({
        where: { ...tenantWhere, date: { gte: rangeStart }, type: 'PLAY' },
        select: { date: true },
      }),
      prisma.content.findMany({
        where: { ...tenantWhere, createdAt: { gte: rangeStart } },
        select: { createdAt: true },
      }),
      prisma.device.findMany({
        where: { ...tenantWhere, lastSeen: { gte: rangeStart } },
        select: { lastSeen: true },
      }),
    ]);

    // 인메모리 집계
    const toDateKey = (d) => new Date(d).toISOString().split('T')[0];
    const statsMap = {};
    statsRows.forEach(r => {
      const k = toDateKey(r.date);
      statsMap[k] = (statsMap[k] || 0) + 1;
    });
    const contentMap = {};
    contentRows.forEach(r => {
      const k = toDateKey(r.createdAt);
      contentMap[k] = (contentMap[k] || 0) + 1;
    });
    // activeDevices: devices seen on that day or any later day up to range end
    // (approximated as seen within day range — use lastSeen date bucket)
    const deviceMap = {};
    deviceRows.forEach(r => {
      if (!r.lastSeen) return;
      const k = toDateKey(r.lastSeen);
      deviceMap[k] = (deviceMap[k] || 0) + 1;
    });

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().split('T')[0];
      days.push({
        date: key,
        label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
        plays: statsMap[key] || 0,
        newContent: contentMap[key] || 0,
        activeDevices: deviceMap[key] || 0,
      });
    }

    res.json({ trend: days });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Device uptime report
const getDeviceUptime = async (req, res) => {
  try {
    const tenantWhere = req.tenantId ? { tenantId: req.tenantId } : {};

    const devices = await prisma.device.findMany({
      where: tenantWhere,
      select: {
        id: true,
        name: true,
        status: true,
        lastSeen: true,
        createdAt: true,
        store: { select: { name: true } },
      },
      orderBy: { lastSeen: 'desc' },
    });

    const now = new Date();
    const report = devices.map(d => {
      const lastSeen = d.lastSeen ? new Date(d.lastSeen) : null;
      const offlineMinutes = lastSeen ? Math.floor((now.getTime() - lastSeen.getTime()) / 60000) : null;

      return {
        id: d.id,
        name: d.name,
        store: d.store?.name || '-',
        status: d.status,
        lastSeen: d.lastSeen,
        offlineMinutes,
        isHealthy: d.status === 'ONLINE' || (offlineMinutes !== null && offlineMinutes < 30),
      };
    });

    const totalDevices = report.length;
    const healthyDevices = report.filter(d => d.isHealthy).length;

    res.json({
      devices: report,
      summary: {
        total: totalDevices,
        healthy: healthyDevices,
        unhealthy: totalDevices - healthyDevices,
        uptimePercent: totalDevices > 0 ? Math.round((healthyDevices / totalDevices) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Content performance report
const getContentPerformance = async (req, res) => {
  try {
    const tenantWhere = req.tenantId ? { tenantId: req.tenantId } : {};

    const contents = await prisma.content.findMany({
      where: { ...tenantWhere, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    // 50개 개별 aggregate → 단일 groupBy + 인메모리 조인
    const contentIds = contents.map(c => c.id);
    const statsRows = contentIds.length > 0
      ? await prisma.statistics.groupBy({
          by: ['contentId'],
          where: { contentId: { in: contentIds } },
          _count: { id: true },
          _sum: { value: true },
        })
      : [];
    const statsMap = new Map(statsRows.map(r => [r.contentId, r]));

    const performance = contents.map(c => {
      const s = statsMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        playCount: s?._count?.id || 0,
        totalDuration: s?._sum?.value || 0,
        createdAt: c.createdAt,
      };
    });

    performance.sort((a, b) => b.playCount - a.playCount);

    res.json({ content: performance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDashboardStats, getContentStats, getDeviceStats, getDailyReport, getWeeklyTrend, getDeviceUptime, getContentPerformance };
