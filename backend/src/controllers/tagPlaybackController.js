/**
 * V4 Phase 14: 태그 기반 조건 재생 & 이벤트
 * - 장치 태그 관리
 * - 스케줄 조건 관리
 * - 태그 매칭 배포 로직
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');

// ─── 장치 태그 관리 ───────────────────────────────

/**
 * 장치 태그 조회
 */
const getDeviceTags = async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.deviceId },
      select: { id: true, name: true, tags: true }
    });
    if (!device) return res.status(404).json({ error: '장치를 찾을 수 없습니다' });

    res.json({
      deviceId: device.id,
      name: device.name,
      tags: device.tags ? JSON.parse(device.tags) : {}
    });
  } catch (error) {
    res.status(500).json({ error: '태그 조회 실패' });
  }
};

/**
 * 장치 태그 설정 (전체 교체)
 */
const setDeviceTags = async (req, res) => {
  try {
    const { tags } = req.body; // { "매장타입": "카페", "지역": "서울" }
    if (typeof tags !== 'object' || Array.isArray(tags)) {
      return res.status(400).json({ error: '태그는 객체 형식이어야 합니다' });
    }

    const device = await prisma.device.update({
      where: { id: req.params.deviceId },
      data: { tags: JSON.stringify(tags) },
      select: { id: true, name: true, tags: true }
    });

    res.json({
      deviceId: device.id,
      name: device.name,
      tags: JSON.parse(device.tags || '{}')
    });
  } catch (error) {
    res.status(500).json({ error: '태그 설정 실패' });
  }
};

/**
 * 장치 태그 일부 업데이트 (merge)
 */
const updateDeviceTags = async (req, res) => {
  try {
    const { tags } = req.body;
    const device = await prisma.device.findUnique({
      where: { id: req.params.deviceId },
      select: { id: true, tags: true }
    });
    if (!device) return res.status(404).json({ error: '장치를 찾을 수 없습니다' });

    const existing = device.tags ? JSON.parse(device.tags) : {};
    const merged = { ...existing, ...tags };

    // null 값인 키는 삭제
    for (const [key, value] of Object.entries(merged)) {
      if (value === null || value === undefined) delete merged[key];
    }

    const updated = await prisma.device.update({
      where: { id: req.params.deviceId },
      data: { tags: JSON.stringify(merged) },
      select: { id: true, name: true, tags: true }
    });

    res.json({
      deviceId: updated.id,
      name: updated.name,
      tags: JSON.parse(updated.tags || '{}')
    });
  } catch (error) {
    res.status(500).json({ error: '태그 업데이트 실패' });
  }
};

/**
 * 업체 내 모든 태그 키 목록 (자동완성용)
 */
const listTagKeys = async (req, res) => {
  try {
    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;

    const devices = await prisma.device.findMany({
      where,
      select: { tags: true }
    });

    const keySet = new Set();
    const keyValues = {};

    for (const device of devices) {
      if (!device.tags) continue;
      try {
        const tags = JSON.parse(device.tags);
        for (const [key, value] of Object.entries(tags)) {
          keySet.add(key);
          if (!keyValues[key]) keyValues[key] = new Set();
          keyValues[key].add(String(value));
        }
      } catch { /* skip invalid JSON */ }
    }

    const result = Array.from(keySet).map(key => ({
      key,
      values: Array.from(keyValues[key] || [])
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '태그 키 목록 조회 실패' });
  }
};

// ─── 스케줄 조건 관리 ─────────────────────────────

/**
 * 스케줄에 조건 추가
 */
const addScheduleCondition = async (req, res) => {
  try {
    const { tagKey, tagValue, playlistId, priority } = req.body;
    if (!tagKey || !tagValue || !playlistId) {
      return res.status(400).json({ error: '태그 키, 값, 플레이리스트가 필요합니다' });
    }

    const schedule = await prisma.schedule.findUnique({ where: { id: req.params.scheduleId } });
    if (!schedule) return res.status(404).json({ error: '스케줄을 찾을 수 없습니다' });

    const condition = await prisma.scheduleCondition.create({
      data: {
        id: uuidv4(),
        scheduleId: req.params.scheduleId,
        tagKey,
        tagValue,
        playlistId,
        priority: priority || 0
      },
      include: {
        playlist: { select: { id: true, name: true } }
      }
    });

    res.status(201).json(condition);
  } catch (error) {
    res.status(500).json({ error: '조건 추가 실패' });
  }
};

/**
 * 스케줄 조건 목록 조회
 */
const listScheduleConditions = async (req, res) => {
  try {
    const conditions = await prisma.scheduleCondition.findMany({
      where: { scheduleId: req.params.scheduleId },
      include: {
        playlist: { select: { id: true, name: true } }
      },
      orderBy: { priority: 'desc' }
    });

    res.json(conditions);
  } catch (error) {
    res.status(500).json({ error: '조건 목록 조회 실패' });
  }
};

/**
 * 스케줄 조건 삭제
 */
const deleteScheduleCondition = async (req, res) => {
  try {
    const condition = await prisma.scheduleCondition.findUnique({ where: { id: req.params.conditionId } });
    if (!condition) return res.status(404).json({ error: '조건을 찾을 수 없습니다' });
    if (condition.scheduleId !== req.params.scheduleId) return res.status(403).json({ error: '해당 스케줄의 조건이 아닙니다' });

    await prisma.scheduleCondition.delete({
      where: { id: req.params.conditionId }
    });
    res.json({ message: '조건이 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '조건 삭제 실패' });
  }
};

/**
 * 스케줄 조건 수정
 */
const updateScheduleCondition = async (req, res) => {
  try {
    const { tagKey, tagValue, playlistId, priority } = req.body;

    const condition = await prisma.scheduleCondition.update({
      where: { id: req.params.conditionId },
      data: {
        ...(tagKey !== undefined && { tagKey }),
        ...(tagValue !== undefined && { tagValue }),
        ...(playlistId !== undefined && { playlistId }),
        ...(priority !== undefined && { priority }),
      },
      include: {
        playlist: { select: { id: true, name: true } }
      }
    });

    res.json(condition);
  } catch (error) {
    res.status(500).json({ error: '조건 수정 실패' });
  }
};

// ─── 태그 매칭 배포 ──────────────────────────────

/**
 * 스케줄 배포 시 장치별 태그 매칭하여 적절한 플레이리스트 결정
 * POST /api/tag-playback/resolve/:scheduleId
 */
const resolveTagPlayback = async (req, res) => {
  try {
    const scheduleId = req.params.scheduleId;

    // 스케줄 + 조건 + 배정 장치 로드
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        conditions: {
          include: { playlist: { select: { id: true, name: true } } },
          orderBy: { priority: 'desc' }
        },
        devices: {
          include: {
            device: { select: { id: true, name: true, deviceId: true, tags: true } }
          }
        },
        playlist: { select: { id: true, name: true } }
      }
    });

    if (!schedule) return res.status(404).json({ error: '스케줄을 찾을 수 없습니다' });

    const results = [];

    for (const sd of schedule.devices) {
      const device = sd.device;
      const deviceTags = device.tags ? JSON.parse(device.tags) : {};

      let matchedPlaylist = null;
      let matchedCondition = null;

      // 우선순위 높은 조건부터 매칭
      for (const condition of schedule.conditions) {
        const deviceValue = deviceTags[condition.tagKey];
        if (deviceValue !== undefined && String(deviceValue) === String(condition.tagValue)) {
          matchedPlaylist = condition.playlist;
          matchedCondition = condition;
          break;
        }
      }

      // 매칭 안 되면 스케줄 기본 플레이리스트
      if (!matchedPlaylist && schedule.playlist) {
        matchedPlaylist = schedule.playlist;
      }

      results.push({
        device: {
          id: device.id,
          name: device.name,
          deviceId: device.deviceId,
          tags: deviceTags
        },
        matchedPlaylist,
        matchedCondition: matchedCondition ? {
          tagKey: matchedCondition.tagKey,
          tagValue: matchedCondition.tagValue,
          priority: matchedCondition.priority
        } : null,
        fallback: !matchedCondition && !!matchedPlaylist
      });
    }

    res.json({
      scheduleId,
      scheduleName: schedule.name,
      conditionCount: schedule.conditions.length,
      deviceCount: schedule.devices.length,
      results
    });
  } catch (error) {
    console.error('Resolve tag playback error:', error);
    res.status(500).json({ error: '태그 매칭 해석 실패' });
  }
};

/**
 * 태그 기반으로 장치 검색
 * GET /api/tag-playback/devices?tagKey=매장타입&tagValue=카페
 */
const searchDevicesByTag = async (req, res) => {
  try {
    const { tagKey, tagValue } = req.query;
    if (!tagKey) return res.status(400).json({ error: 'tagKey가 필요합니다' });

    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;

    const devices = await prisma.device.findMany({
      where,
      select: { id: true, name: true, deviceId: true, status: true, location: true, tags: true }
    });

    const matched = devices.filter(device => {
      if (!device.tags) return false;
      try {
        const tags = JSON.parse(device.tags);
        if (tagValue) {
          return String(tags[tagKey]) === String(tagValue);
        }
        return tags[tagKey] !== undefined;
      } catch { return false; }
    }).map(device => ({
      ...device,
      tags: JSON.parse(device.tags || '{}')
    }));

    res.json({ total: matched.length, devices: matched });
  } catch (error) {
    res.status(500).json({ error: '태그 검색 실패' });
  }
};

module.exports = {
  getDeviceTags, setDeviceTags, updateDeviceTags, listTagKeys,
  addScheduleCondition, listScheduleConditions, deleteScheduleCondition, updateScheduleCondition,
  resolveTagPlayback, searchDevicesByTag
};
