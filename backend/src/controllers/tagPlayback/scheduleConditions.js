/**
 * Schedule condition (tag-matched playlist rule) CRUD.
 *
 * Tenant isolation rules:
 *   1. The target schedule MUST belong to the caller's tenant.
 *   2. The referenced playlist MUST belong to the same tenant as the
 *      schedule. Without this, a tenant-A user could attach a condition
 *      referencing tenant-B's playlist, causing tenant-B content to be
 *      resolved and played on tenant-A devices (cross-tenant injection).
 */

const prisma = require('../../utils/prisma');
const { v4: uuidv4 } = require('uuid');
const { verifyTenantOwnership } = require('../../middleware/tenant');

/**
 * Load the schedule for ownership checks. Sends 404 when missing.
 */
async function loadSchedule(scheduleId, res) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, tenantId: true }
  });
  if (!schedule) {
    res.status(404).json({ error: '스케줄을 찾을 수 없습니다' });
    return null;
  }
  return schedule;
}

/**
 * Verify the referenced playlist belongs to the schedule's tenant.
 * Returns true on success; sends 403/404 and returns false on failure.
 */
async function assertPlaylistSameTenant(playlistId, scheduleTenantId, res) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: { id: true, tenantId: true }
  });
  if (!playlist) {
    res.status(404).json({ error: '플레이리스트를 찾을 수 없습니다' });
    return false;
  }
  if (playlist.tenantId !== scheduleTenantId) {
    res.status(403).json({ error: '다른 업체의 플레이리스트는 사용할 수 없습니다' });
    return false;
  }
  return true;
}

/**
 * POST /conditions/:scheduleId — attach a new tag-matched playlist rule.
 */
const addScheduleCondition = async (req, res) => {
  try {
    const { tagKey, tagValue, playlistId, priority } = req.body;
    if (!tagKey || !tagValue || !playlistId) {
      return res.status(400).json({ error: '태그 키, 값, 플레이리스트가 필요합니다' });
    }

    const schedule = await loadSchedule(req.params.scheduleId, res);
    if (!schedule) return;
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Cross-tenant playlist injection guard
    if (!(await assertPlaylistSameTenant(playlistId, schedule.tenantId, res))) return;

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
 * GET /conditions/:scheduleId — list all conditions on a schedule.
 */
const listScheduleConditions = async (req, res) => {
  try {
    const schedule = await loadSchedule(req.params.scheduleId, res);
    if (!schedule) return;
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

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
 * DELETE /conditions/:scheduleId/:conditionId
 */
const deleteScheduleCondition = async (req, res) => {
  try {
    const schedule = await loadSchedule(req.params.scheduleId, res);
    if (!schedule) return;
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const condition = await prisma.scheduleCondition.findUnique({
      where: { id: req.params.conditionId }
    });
    if (!condition) return res.status(404).json({ error: '조건을 찾을 수 없습니다' });
    if (condition.scheduleId !== req.params.scheduleId) {
      return res.status(403).json({ error: '해당 스케줄의 조건이 아닙니다' });
    }

    await prisma.scheduleCondition.delete({
      where: { id: req.params.conditionId }
    });
    res.json({ message: '조건이 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '조건 삭제 실패' });
  }
};

/**
 * PUT /conditions/:scheduleId/:conditionId
 */
const updateScheduleCondition = async (req, res) => {
  try {
    const { tagKey, tagValue, playlistId, priority } = req.body;

    const schedule = await loadSchedule(req.params.scheduleId, res);
    if (!schedule) return;
    if (!verifyTenantOwnership(schedule, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const existing = await prisma.scheduleCondition.findUnique({
      where: { id: req.params.conditionId }
    });
    if (!existing) return res.status(404).json({ error: '조건을 찾을 수 없습니다' });
    if (existing.scheduleId !== req.params.scheduleId) {
      return res.status(403).json({ error: '해당 스케줄의 조건이 아닙니다' });
    }

    // When reassigning playlistId, re-verify tenant alignment.
    if (playlistId !== undefined && playlistId !== existing.playlistId) {
      if (!(await assertPlaylistSameTenant(playlistId, schedule.tenantId, res))) return;
    }

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

module.exports = {
  addScheduleCondition,
  listScheduleConditions,
  deleteScheduleCondition,
  updateScheduleCondition,
};
