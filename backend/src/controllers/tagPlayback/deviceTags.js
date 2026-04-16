/**
 * Device tag management.
 *
 * Tenant isolation: every mutation/read of a device.tags row MUST go through
 * verifyTenantOwnership. Without this check, any authenticated user could
 * read or overwrite tags on any other tenant's devices given only the
 * device PK (cross-tenant IDOR — confirmed attack vector, fixed here).
 */

const prisma = require('../../utils/prisma');
const { verifyTenantOwnership } = require('../../middleware/tenant');

/**
 * Load device with tenantId for ownership verification.
 * Sends 404 and returns null when the device does not exist.
 */
async function loadDevice(deviceId, res) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, name: true, tags: true, tenantId: true }
  });
  if (!device) {
    res.status(404).json({ error: '장치를 찾을 수 없습니다' });
    return null;
  }
  return device;
}

/**
 * GET /tags/:deviceId — read a device's tag map.
 */
const getDeviceTags = async (req, res) => {
  try {
    const device = await loadDevice(req.params.deviceId, res);
    if (!device) return;
    if (!verifyTenantOwnership(device, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

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
 * PUT /tags/:deviceId — replace the device's tag map wholesale.
 */
const setDeviceTags = async (req, res) => {
  try {
    const { tags } = req.body;
    if (typeof tags !== 'object' || tags === null || Array.isArray(tags)) {
      return res.status(400).json({ error: '태그는 객체 형식이어야 합니다' });
    }

    const device = await loadDevice(req.params.deviceId, res);
    if (!device) return;
    if (!verifyTenantOwnership(device, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const updated = await prisma.device.update({
      where: { id: req.params.deviceId },
      data: { tags: JSON.stringify(tags) },
      select: { id: true, name: true, tags: true }
    });

    res.json({
      deviceId: updated.id,
      name: updated.name,
      tags: JSON.parse(updated.tags || '{}')
    });
  } catch (error) {
    res.status(500).json({ error: '태그 설정 실패' });
  }
};

/**
 * PATCH /tags/:deviceId — merge into the existing tag map.
 * Keys whose value is null/undefined are removed from the merged map.
 */
const updateDeviceTags = async (req, res) => {
  try {
    const { tags } = req.body;
    const device = await loadDevice(req.params.deviceId, res);
    if (!device) return;
    if (!verifyTenantOwnership(device, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const existing = device.tags ? JSON.parse(device.tags) : {};
    const merged = { ...existing, ...tags };
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
 * GET /tags/keys — autocomplete source for tag keys and values.
 * Uses the standard tenantId filter (SUPER_ADMIN with no X-Tenant-Id sees all).
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

module.exports = { getDeviceTags, setDeviceTags, updateDeviceTags, listTagKeys };
