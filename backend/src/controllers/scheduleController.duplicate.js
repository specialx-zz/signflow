/**
 * scheduleController.duplicate.js
 *
 * Handles POST /:id/duplicate — creates a deep copy of a schedule
 * (including its scheduleDevice assignments) owned by the same tenant.
 *
 * Split from scheduleController.js to keep each file under 300 lines.
 */

const prisma = require('../utils/prisma');
const { verifyTenantOwnership } = require('../middleware/tenant');
const { v4: uuidv4 } = require('uuid');

/**
 * Duplicate an existing schedule.
 *
 * - Copies all scalar fields from the source schedule.
 * - Forces status to 'DRAFT' and createdBy to the requesting user.
 * - Uses the SOURCE tenantId (not req.tenantId) so SUPER_ADMIN cannot
 *   accidentally create a cross-tenant copy.
 * - Copies scheduleDevice rows with new IDs and status PENDING.
 */
const duplicateSchedule = async (req, res) => {
  try {
    // Load source schedule with device assignments
    const source = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: { devices: true }
    });

    if (!source) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    if (!verifyTenantOwnership(source, req)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    // Create the duplicated schedule record
    const newSchedule = await prisma.schedule.create({
      data: {
        id: uuidv4(),
        name: `${source.name} (복사본)`,
        type: source.type,
        playlistId: source.playlistId,
        layoutId: source.layoutId,
        startDate: source.startDate,
        endDate: source.endDate,
        startTime: source.startTime,
        endTime: source.endTime,
        repeatType: source.repeatType,
        repeatDays: source.repeatDays,
        // Keep settings JSON string as-is — no re-serialisation needed
        settings: source.settings,
        createdBy: req.user.id,
        status: 'DRAFT',
        // Use SOURCE tenantId to prevent SUPER_ADMIN cross-tenant copies
        tenantId: source.tenantId
      }
    });

    // Copy device assignments with fresh IDs and PENDING status
    if (source.devices && source.devices.length > 0) {
      await prisma.scheduleDevice.createMany({
        data: source.devices.map(sd => ({
          id: uuidv4(),
          scheduleId: newSchedule.id,
          deviceId: sd.deviceId,
          status: 'PENDING'
        }))
      });
    }

    // Return full result with related models
    const result = await prisma.schedule.findUnique({
      where: { id: newSchedule.id },
      include: {
        creator: { select: { id: true, username: true } },
        playlist: { select: { id: true, name: true } },
        layout: { select: { id: true, name: true } },
        devices: { include: { device: { select: { id: true, name: true } } } }
      }
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Duplicate schedule error:', error);
    res.status(500).json({ error: 'Failed to duplicate schedule' });
  }
};

module.exports = { duplicateSchedule };
