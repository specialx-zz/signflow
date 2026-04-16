/**
 * Tag-matching resolution & tag-based device search.
 *
 * Tenant isolation:
 *   - resolveTagPlayback: the schedule MUST belong to the caller's tenant.
 *     Otherwise an attacker could enumerate another tenant's device layout
 *     by invoking resolve on any leaked scheduleId.
 *   - searchDevicesByTag: follows the standard tenantId filter pattern
 *     (SUPER_ADMIN with no X-Tenant-Id sees all tenants, by design).
 */

const prisma = require('../../utils/prisma');
const { verifyTenantOwnership } = require('../../middleware/tenant');

/**
 * POST /resolve/:scheduleId — compute the per-device playlist mapping.
 */
const resolveTagPlayback = async (req, res) => {
  try {
    const scheduleId = req.params.scheduleId;

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
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const results = [];

    for (const sd of schedule.devices) {
      const device = sd.device;
      const deviceTags = device.tags ? JSON.parse(device.tags) : {};

      let matchedPlaylist = null;
      let matchedCondition = null;

      // Highest-priority condition wins
      for (const condition of schedule.conditions) {
        const deviceValue = deviceTags[condition.tagKey];
        if (deviceValue !== undefined && String(deviceValue) === String(condition.tagValue)) {
          matchedPlaylist = condition.playlist;
          matchedCondition = condition;
          break;
        }
      }

      // Fallback to the schedule's default playlist
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
 * GET /devices?tagKey=...&tagValue=... — find devices with matching tags.
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

module.exports = { resolveTagPlayback, searchDevicesByTag };
