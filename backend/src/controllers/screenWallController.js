/**
 * V4 Phase 15: 스크린 월 & 동기화 재생 컨트롤러
 */

const prisma = require('../utils/prisma');
const { v4: uuidv4 } = require('uuid');
const { verifyTenantOwnership } = require('../middleware/tenant');

// ═══════════════════════════════════════════════════
// 스크린 월 CRUD
// ═══════════════════════════════════════════════════

const listScreenWalls = async (req, res) => {
  try {
    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;

    const walls = await prisma.screenWall.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        devices: {
          include: {
            device: { select: { id: true, name: true, deviceId: true, status: true } }
          },
          orderBy: [{ row: 'asc' }, { col: 'asc' }]
        }
      }
    });

    res.json(walls);
  } catch (error) {
    res.status(500).json({ error: '스크린 월 목록 조회 실패' });
  }
};

const getScreenWall = async (req, res) => {
  try {
    const wall = await prisma.screenWall.findUnique({
      where: { id: req.params.id },
      include: {
        devices: {
          include: {
            device: { select: { id: true, name: true, deviceId: true, status: true, resolution: true } }
          },
          orderBy: [{ row: 'asc' }, { col: 'asc' }]
        }
      }
    });
    if (!wall) return res.status(404).json({ error: '스크린 월을 찾을 수 없습니다' });

    // 베젤 보정 계산 포함
    const totalRes = calculateWallResolution(wall);
    res.json({ ...wall, totalResolution: totalRes });
  } catch (error) {
    res.status(500).json({ error: '스크린 월 조회 실패' });
  }
};

const createScreenWall = async (req, res) => {
  try {
    const { name, rows, cols, bezelH, bezelV, screenW, screenH } = req.body;
    if (!name || !rows || !cols) {
      return res.status(400).json({ error: '이름, 행, 열이 필요합니다' });
    }
    if (rows < 1 || rows > 10 || cols < 1 || cols > 10) {
      return res.status(400).json({ error: '행/열은 1~10 범위여야 합니다' });
    }

    const wall = await prisma.screenWall.create({
      data: {
        id: uuidv4(),
        name,
        rows: parseInt(rows),
        cols: parseInt(cols),
        bezelH: parseFloat(bezelH) || 0,
        bezelV: parseFloat(bezelV) || 0,
        screenW: screenW ? parseFloat(screenW) : null,
        screenH: screenH ? parseFloat(screenH) : null,
        tenantId: req.tenantId || req.user.tenantId,
        createdBy: req.user.id
      }
    });

    res.status(201).json(wall);
  } catch (error) {
    console.error('Create screen wall error:', error);
    res.status(500).json({ error: '스크린 월 생성 실패' });
  }
};

const updateScreenWall = async (req, res) => {
  try {
    const { name, rows, cols, bezelH, bezelV, screenW, screenH, isActive } = req.body;

    const existing = await prisma.screenWall.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '스크린 월을 찾을 수 없습니다' });
    if (!verifyTenantOwnership(existing, req)) return res.status(403).json({ error: '권한이 없습니다' });

    const wall = await prisma.screenWall.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(rows !== undefined && { rows: parseInt(rows) }),
        ...(cols !== undefined && { cols: parseInt(cols) }),
        ...(bezelH !== undefined && { bezelH: parseFloat(bezelH) }),
        ...(bezelV !== undefined && { bezelV: parseFloat(bezelV) }),
        ...(screenW !== undefined && { screenW: screenW ? parseFloat(screenW) : null }),
        ...(screenH !== undefined && { screenH: screenH ? parseFloat(screenH) : null }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json(wall);
  } catch (error) {
    res.status(500).json({ error: '스크린 월 수정 실패' });
  }
};

const deleteScreenWall = async (req, res) => {
  try {
    const wall = await prisma.screenWall.findUnique({ where: { id: req.params.id } });
    if (!wall) return res.status(404).json({ error: '스크린 월을 찾을 수 없습니다' });
    if (!verifyTenantOwnership(wall, req)) return res.status(403).json({ error: '권한이 없습니다' });

    await prisma.screenWall.delete({ where: { id: req.params.id } });
    res.json({ message: '스크린 월이 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '스크린 월 삭제 실패' });
  }
};

// ─── 장치 배치 ─────────────────────────────────────

const assignDevice = async (req, res) => {
  try {
    const { deviceId, row, col } = req.body;
    const wall = await prisma.screenWall.findUnique({ where: { id: req.params.id } });
    if (!wall) return res.status(404).json({ error: '스크린 월을 찾을 수 없습니다' });
    if (row < 0 || row >= wall.rows || col < 0 || col >= wall.cols) {
      return res.status(400).json({ error: '행/열이 범위를 벗어납니다' });
    }

    // 해당 위치에 이미 장치가 있으면 교체
    await prisma.screenWallDevice.deleteMany({
      where: { wallId: req.params.id, row, col }
    });

    const assignment = await prisma.screenWallDevice.create({
      data: {
        id: uuidv4(),
        wallId: req.params.id,
        deviceId,
        row, col
      },
      include: {
        device: { select: { id: true, name: true, deviceId: true, status: true } }
      }
    });

    res.status(201).json(assignment);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '이 장치는 이미 다른 위치에 배치되어 있습니다' });
    }
    res.status(500).json({ error: '장치 배치 실패' });
  }
};

const removeDevice = async (req, res) => {
  try {
    await prisma.screenWallDevice.deleteMany({
      where: { wallId: req.params.id, deviceId: req.params.deviceId }
    });
    res.json({ message: '장치가 제거되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '장치 제거 실패' });
  }
};

// 전체 배치 일괄 설정
const setLayout = async (req, res) => {
  try {
    const { devices } = req.body; // [{deviceId, row, col}]
    if (!Array.isArray(devices)) return res.status(400).json({ error: 'devices 배열이 필요합니다' });

    // 기존 배치 모두 삭제
    await prisma.screenWallDevice.deleteMany({ where: { wallId: req.params.id } });

    // 새로 배치
    if (devices.length > 0) {
      await prisma.screenWallDevice.createMany({
        data: devices.map(d => ({
          id: uuidv4(),
          wallId: req.params.id,
          deviceId: d.deviceId,
          row: d.row,
          col: d.col
        }))
      });
    }

    const updated = await prisma.screenWall.findUnique({
      where: { id: req.params.id },
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, deviceId: true, status: true } } },
          orderBy: [{ row: 'asc' }, { col: 'asc' }]
        }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: '배치 설정 실패' });
  }
};

// 특정 장치의 스크린 월 정보 (플레이어용)
const getDeviceWallInfo = async (req, res) => {
  try {
    const paramId = req.params.deviceId;

    // 1차: 서버 PK(id)로 직접 조회
    let assignment = await prisma.screenWallDevice.findFirst({
      where: { deviceId: paramId },
      include: { wall: true }
    });

    // 2차: Player UUID(deviceId 필드)로 조회 — Player는 자체 생성 UUID를 사용
    if (!assignment) {
      const device = await prisma.device.findFirst({
        where: { deviceId: paramId }
      });
      if (device) {
        assignment = await prisma.screenWallDevice.findFirst({
          where: { deviceId: device.id },
          include: { wall: true }
        });
      }
    }

    if (!assignment) {
      return res.json({ inWall: false });
    }

    const wall = assignment.wall;
    const bezelCompensation = calculateBezelCompensation(wall, assignment.row, assignment.col);

    res.json({
      inWall: true,
      wallId: wall.id,
      wallName: wall.name,
      rows: wall.rows,
      cols: wall.cols,
      row: assignment.row,
      col: assignment.col,
      bezel: {
        h: wall.bezelH,
        v: wall.bezelV,
        screenW: wall.screenW,
        screenH: wall.screenH
      },
      transform: bezelCompensation
    });
  } catch (error) {
    res.status(500).json({ error: '장치 월 정보 조회 실패' });
  }
};

// ═══════════════════════════════════════════════════
// 동기화 재생 그룹
// ═══════════════════════════════════════════════════

const listSyncGroups = async (req, res) => {
  try {
    const where = {};
    if (req.tenantId) where.tenantId = req.tenantId;

    const groups = await prisma.syncGroup.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        devices: {
          include: {
            device: { select: { id: true, name: true, deviceId: true, status: true } }
          }
        }
      }
    });

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: '동기화 그룹 목록 조회 실패' });
  }
};

const createSyncGroup = async (req, res) => {
  try {
    const { name, syncMode, driftThreshold, deviceIds, masterDeviceId } = req.body;
    if (!name) return res.status(400).json({ error: '그룹 이름이 필요합니다' });

    const group = await prisma.syncGroup.create({
      data: {
        id: uuidv4(),
        name,
        syncMode: syncMode || 'LAN',
        driftThreshold: driftThreshold || (syncMode === 'WAN' ? 1000 : 200),
        masterDeviceId: masterDeviceId || null,
        tenantId: req.tenantId || req.user.tenantId,
        createdBy: req.user.id,
        ...(deviceIds?.length > 0 && {
          devices: {
            create: deviceIds.map((deviceId, idx) => ({
              id: uuidv4(),
              deviceId,
              isMaster: deviceId === masterDeviceId || (idx === 0 && !masterDeviceId)
            }))
          }
        })
      },
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, deviceId: true, status: true } } }
        }
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Create sync group error:', error);
    res.status(500).json({ error: '동기화 그룹 생성 실패' });
  }
};

const updateSyncGroup = async (req, res) => {
  try {
    const { name, syncMode, driftThreshold, masterDeviceId, isActive } = req.body;

    const group = await prisma.syncGroup.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(syncMode !== undefined && { syncMode }),
        ...(driftThreshold !== undefined && { driftThreshold }),
        ...(masterDeviceId !== undefined && { masterDeviceId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, deviceId: true, status: true } } }
        }
      }
    });

    res.json(group);
  } catch (error) {
    res.status(500).json({ error: '동기화 그룹 수정 실패' });
  }
};

const deleteSyncGroup = async (req, res) => {
  try {
    const group = await prisma.syncGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: '동기화 그룹을 찾을 수 없습니다' });
    if (!verifyTenantOwnership(group, req)) return res.status(403).json({ error: '권한이 없습니다' });

    await prisma.syncGroup.delete({ where: { id: req.params.id } });
    res.json({ message: '동기화 그룹이 삭제되었습니다' });
  } catch (error) {
    res.status(500).json({ error: '동기화 그룹 삭제 실패' });
  }
};

const setSyncGroupDevices = async (req, res) => {
  try {
    const { deviceIds, masterDeviceId } = req.body;
    if (!Array.isArray(deviceIds)) return res.status(400).json({ error: 'deviceIds 배열이 필요합니다' });

    await prisma.syncGroupDevice.deleteMany({ where: { groupId: req.params.id } });

    if (deviceIds.length > 0) {
      await prisma.syncGroupDevice.createMany({
        data: deviceIds.map(deviceId => ({
          id: uuidv4(),
          groupId: req.params.id,
          deviceId,
          isMaster: deviceId === masterDeviceId
        }))
      });
    }

    if (masterDeviceId) {
      await prisma.syncGroup.update({
        where: { id: req.params.id },
        data: { masterDeviceId }
      });
    }

    const updated = await prisma.syncGroup.findUnique({
      where: { id: req.params.id },
      include: {
        devices: {
          include: { device: { select: { id: true, name: true, deviceId: true, status: true } } }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: '장치 설정 실패' });
  }
};

// ═══════════════════════════════════════════════════
// 유틸리티 함수
// ═══════════════════════════════════════════════════

function calculateWallResolution(wall) {
  // 기본 1920x1080 가정
  const screenResW = 1920;
  const screenResH = 1080;
  return {
    width: wall.cols * screenResW,
    height: wall.rows * screenResH,
    label: `${wall.cols * screenResW} × ${wall.rows * screenResH}`
  };
}

function calculateBezelCompensation(wall, row, col) {
  const screenResW = 1920;
  const screenResH = 1080;

  if (!wall.bezelH && !wall.bezelV) {
    // 베젤 없음 — 단순 CSS transform
    return {
      scale: `${wall.cols}, ${wall.rows}`,
      translateX: `-${col * 100}%`,
      translateY: `-${row * 100}%`,
      css: `scale(${wall.cols}, ${wall.rows}) translate(-${col * 100 / wall.cols}%, -${row * 100 / wall.rows}%)`
    };
  }

  // 베젤 보정이 있는 경우
  let bezelPxH = 0, bezelPxV = 0;
  if (wall.screenW && wall.bezelH) {
    bezelPxH = (wall.bezelH / wall.screenW) * screenResW;
  }
  if (wall.screenH && wall.bezelV) {
    bezelPxV = (wall.bezelV / wall.screenH) * screenResH;
  }

  const totalW = wall.cols * screenResW;
  const totalH = wall.rows * screenResH;
  const offsetX = col * (screenResW + bezelPxH * 2);
  const offsetY = row * (screenResH + bezelPxV * 2);

  return {
    scale: `${totalW / screenResW}, ${totalH / screenResH}`,
    translateX: `-${offsetX}px`,
    translateY: `-${offsetY}px`,
    bezelPxH,
    bezelPxV,
    css: `scale(${totalW / screenResW}, ${totalH / screenResH}) translate(-${offsetX}px, -${offsetY}px)`,
    transformOrigin: 'top left'
  };
}

module.exports = {
  listScreenWalls, getScreenWall, createScreenWall, updateScreenWall, deleteScreenWall,
  assignDevice, removeDevice, setLayout, getDeviceWallInfo,
  listSyncGroups, createSyncGroup, updateSyncGroup, deleteSyncGroup, setSyncGroupDevices
};
