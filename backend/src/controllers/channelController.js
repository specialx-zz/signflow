/**
 * V4 Phase 13: 채널 시스템 컨트롤러
 * - 채널 CRUD
 * - 채널 콘텐츠 관리
 * - 채널 장치 배정
 * - 콘텐츠 저니맵
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');

// ─── 채널 CRUD ────────────────────────────────────

const listChannels = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { id: true, username: true } },
          _count: { select: { contents: true, devices: true } }
        }
      }),
      prisma.channel.count({ where })
    ]);

    res.json({
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List channels error:', error);
    res.status(500).json({ error: '채널 목록 조회 실패' });
  }
};

const getChannel = async (req, res) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, username: true } },
        contents: {
          include: {
            content: {
              select: { id: true, name: true, type: true, thumbnail: true, duration: true, isCanvas: true }
            }
          },
          orderBy: { order: 'asc' }
        },
        devices: {
          include: {
            device: {
              select: { id: true, name: true, deviceId: true, status: true, location: true }
            }
          }
        }
      }
    });

    if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다' });
    if (req.tenantId && channel.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: '채널 조회 실패' });
  }
};

const createChannel = async (req, res) => {
  try {
    const { name, description, isDefault } = req.body;
    const tenantId = req.tenantId || req.user.tenantId;

    if (!name) return res.status(400).json({ error: '채널 이름이 필요합니다' });

    // isDefault인 경우, 기존 기본 채널 해제
    if (isDefault) {
      await prisma.channel.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false }
      });
    }

    const channel = await prisma.channel.create({
      data: {
        id: uuidv4(),
        name,
        description,
        isDefault: isDefault || false,
        tenantId,
        createdBy: req.user.id
      },
      include: {
        creator: { select: { id: true, username: true } },
        _count: { select: { contents: true, devices: true } }
      }
    });

    res.status(201).json(channel);
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: '채널 생성 실패' });
  }
};

const updateChannel = async (req, res) => {
  try {
    const { name, description, isDefault, isActive } = req.body;
    const existing = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '채널을 찾을 수 없습니다' });
    if (req.tenantId && existing.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    if (isDefault) {
      await prisma.channel.updateMany({
        where: { tenantId: existing.tenantId, isDefault: true, NOT: { id: existing.id } },
        data: { isDefault: false }
      });
    }

    const channel = await prisma.channel.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        creator: { select: { id: true, username: true } },
        _count: { select: { contents: true, devices: true } }
      }
    });

    res.json(channel);
  } catch (error) {
    res.status(500).json({ error: '채널 수정 실패' });
  }
};

const deleteChannel = async (req, res) => {
  try {
    const existing = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '채널을 찾을 수 없습니다' });
    if (req.tenantId && existing.tenantId !== req.tenantId) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    await prisma.channel.delete({ where: { id: req.params.id } });
    res.json({ message: '채널이 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '채널 삭제 실패' });
  }
};

// ─── 채널 콘텐츠 관리 ─────────────────────────────

const addContent = async (req, res) => {
  try {
    const { contentId, duration } = req.body;
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: { contents: { orderBy: { order: 'desc' }, take: 1 } }
    });
    if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다' });

    const maxOrder = channel.contents[0]?.order ?? -1;

    const item = await prisma.channelContent.create({
      data: {
        id: uuidv4(),
        channelId: req.params.id,
        contentId,
        duration: duration || null,
        order: maxOrder + 1
      },
      include: {
        content: { select: { id: true, name: true, type: true, thumbnail: true, duration: true } }
      }
    });

    // V5.2: Socket.IO로 채널 소속 장치에 실시간 업데이트 통지
    await notifyChannelDevices(req, req.params.id);

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: '콘텐츠 추가 실패' });
  }
};

const removeContent = async (req, res) => {
  try {
    const { contentItemId } = req.params;
    const item = await prisma.channelContent.findUnique({ where: { id: contentItemId } });
    if (!item) return res.status(404).json({ error: '콘텐츠 항목을 찾을 수 없습니다' });
    await prisma.channelContent.delete({ where: { id: contentItemId } });
    await notifyChannelDevices(req, item.channelId);
    res.json({ message: '콘텐츠가 제거되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '콘텐츠 제거 실패' });
  }
};

const reorderContents = async (req, res) => {
  try {
    const { items } = req.body; // [{id, order}]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items 배열이 필요합니다' });
    }

    // IDOR guard: verify every item belongs to this channel
    const itemIds = items.map(i => i.id);
    const existingItems = await prisma.channelContent.findMany({
      where: { id: { in: itemIds }, channelId: req.params.id },
      select: { id: true }
    });
    if (existingItems.length !== itemIds.length) {
      return res.status(403).json({ error: '잘못된 아이템 ID가 포함되어 있습니다' });
    }

    await Promise.all(
      items.map(item =>
        prisma.channelContent.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );

    await notifyChannelDevices(req, req.params.id);
    res.json({ message: '순서가 변경되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '순서 변경 실패' });
  }
};

// ─── V5.2: 채널 소속 장치에 Socket.IO 통지 ─────────────────

async function notifyChannelDevices(req, channelId) {
  try {
    const io = req.io;
    if (!io) return;
    const devices = await prisma.channelDevice.findMany({
      where: { channelId },
      include: { device: { select: { deviceId: true } } }
    });
    devices.forEach(d => {
      io.to(`device:${d.device.deviceId}`).emit('channel:update', {
        channelId,
        timestamp: Date.now()
      });
    });
  } catch (e) {
    console.error('[Channel] Socket notification error:', e);
  }
}

// ─── 채널 장치 배정 ───────────────────────────────

const assignDevices = async (req, res) => {
  try {
    const { deviceIds } = req.body;
    if (!Array.isArray(deviceIds)) return res.status(400).json({ error: 'deviceIds 배열이 필요합니다' });

    const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
    if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다' });

    // 기존 배정 삭제 후 새로 추가
    await prisma.channelDevice.deleteMany({ where: { channelId: req.params.id } });

    if (deviceIds.length > 0) {
      await prisma.channelDevice.createMany({
        data: deviceIds.map(deviceId => ({
          channelId: req.params.id,
          deviceId
        }))
      });
    }

    const updated = await prisma.channel.findUnique({
      where: { id: req.params.id },
      include: {
        devices: {
          include: {
            device: { select: { id: true, name: true, deviceId: true, status: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Assign devices error:', error);
    res.status(500).json({ error: '장치 배정 실패' });
  }
};

// ─── 콘텐츠 저니맵 (Journey Map) ──────────────────

const getContentJourney = async (req, res) => {
  try {
    const contentId = req.params.contentId;

    // 1. 콘텐츠 정보
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { id: true, name: true, type: true, thumbnail: true, isCanvas: true }
    });
    if (!content) return res.status(404).json({ error: '콘텐츠를 찾을 수 없습니다' });

    // 2. 이 콘텐츠가 속한 플레이리스트
    const playlistItems = await prisma.playlistItem.findMany({
      where: { contentId },
      include: {
        playlist: {
          select: { id: true, name: true }
        }
      }
    });
    const playlistIds = [...new Set(playlistItems.map(pi => pi.playlistId))];

    // 3. 이 플레이리스트가 속한 스케줄 (Schedule.playlistId로 직접 조회)
    const schedules = playlistIds.length > 0
      ? await prisma.schedule.findMany({
          where: { playlistId: { in: playlistIds } },
          select: { id: true, name: true }
        })
      : [];
    const scheduleIds = schedules.map(s => s.id);

    // 4. 스케줄에 배정된 장치
    const scheduleDevices = scheduleIds.length > 0
      ? await prisma.scheduleDevice.findMany({
          where: { scheduleId: { in: scheduleIds } },
          include: {
            device: { select: { id: true, name: true, deviceId: true, status: true, location: true } }
          }
        })
      : [];

    // 5. 이 콘텐츠가 속한 채널
    const channelContents = await prisma.channelContent.findMany({
      where: { contentId },
      include: {
        channel: {
          select: { id: true, name: true, isDefault: true },
        }
      }
    });
    const channelIds = [...new Set(channelContents.map(cc => cc.channelId))];

    // 6. 채널에 배정된 장치
    const channelDevices = channelIds.length > 0
      ? await prisma.channelDevice.findMany({
          where: { channelId: { in: channelIds } },
          include: {
            device: { select: { id: true, name: true, deviceId: true, status: true, location: true } }
          }
        })
      : [];

    // 장치 중복 제거
    const allDeviceMap = new Map();
    for (const sd of scheduleDevices) {
      allDeviceMap.set(sd.deviceId, sd.device);
    }
    for (const cd of channelDevices) {
      allDeviceMap.set(cd.deviceId, cd.device);
    }

    // 그래프 노드/엣지 구성
    const nodes = [];
    const edges = [];

    // Content node
    nodes.push({ id: contentId, type: 'content', data: content });

    // Playlist nodes + edges
    const playlistMap = new Map();
    for (const pi of playlistItems) {
      if (!playlistMap.has(pi.playlistId)) {
        playlistMap.set(pi.playlistId, pi.playlist);
        nodes.push({ id: pi.playlistId, type: 'playlist', data: pi.playlist });
        edges.push({ source: contentId, target: pi.playlistId });
      }
    }

    // Schedule nodes + edges
    // schedules = [{ id, name }] queried by playlistId; build playlist→schedule edges
    // via the playlistId field on each Schedule record.
    const schedulesWithPlaylist = scheduleIds.length > 0
      ? await prisma.schedule.findMany({
          where: { id: { in: scheduleIds } },
          select: { id: true, name: true, playlistId: true }
        })
      : [];

    const scheduleMap = new Map();
    for (const s of schedulesWithPlaylist) {
      if (!scheduleMap.has(s.id)) {
        scheduleMap.set(s.id, s);
        nodes.push({ id: s.id, type: 'schedule', data: s });
      }
      if (s.playlistId) {
        edges.push({ source: s.playlistId, target: s.id });
      }
    }

    // Schedule → Device edges
    for (const sd of scheduleDevices) {
      if (!nodes.find(n => n.id === sd.deviceId)) {
        nodes.push({ id: sd.deviceId, type: 'device', data: sd.device });
      }
      edges.push({ source: sd.scheduleId, target: sd.deviceId });
    }

    // Channel nodes + edges
    for (const cc of channelContents) {
      if (!nodes.find(n => n.id === cc.channelId)) {
        nodes.push({ id: cc.channelId, type: 'channel', data: cc.channel });
        edges.push({ source: contentId, target: cc.channelId });
      }
    }

    // Channel → Device edges
    for (const cd of channelDevices) {
      if (!nodes.find(n => n.id === cd.deviceId)) {
        nodes.push({ id: cd.deviceId, type: 'device', data: cd.device });
      }
      edges.push({ source: cd.channelId, target: cd.deviceId });
    }

    res.json({
      content,
      playlists: playlistItems.map(pi => pi.playlist),
      channels: channelContents.map(cc => cc.channel),
      totalDevices: allDeviceMap.size,
      graph: { nodes, edges }
    });
  } catch (error) {
    console.error('Journey map error:', error);
    res.status(500).json({ error: '저니맵 조회 실패' });
  }
};

module.exports = {
  listChannels, getChannel, createChannel, updateChannel, deleteChannel,
  addContent, removeContent, reorderContents,
  assignDevices,
  getContentJourney
};
