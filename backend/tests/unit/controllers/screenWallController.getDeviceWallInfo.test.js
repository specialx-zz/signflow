/**
 * Regression guard for screenWallController.getDeviceWallInfo
 *
 * Bug background:
 *   getDeviceWallInfo previously looked up screenWallDevice using only the
 *   server-side Device.id (PK). Players, however, send their self-generated
 *   UUID (Device.deviceId field). The fix introduced a 2-step fallback:
 *     1) screenWallDevice.findFirst({ where: { deviceId: paramId } })
 *     2) if not found → device.findFirst({ where: { deviceId: paramId } })
 *        → screenWallDevice.findFirst({ where: { deviceId: device.id } })
 *
 * These tests pin the 2-step lookup behaviour so future refactors cannot
 * silently regress to the PK-only path.
 */

jest.mock('../../../src/utils/prisma', () => ({
  screenWallDevice: { findFirst: jest.fn() },
  device: { findFirst: jest.fn() },
}));

const prisma = require('../../../src/utils/prisma');
const { getDeviceWallInfo } = require('../../../src/controllers/screenWallController');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

const WALL = {
  id: 'wall-1',
  name: 'Lobby Wall',
  rows: 2,
  cols: 2,
  bezelH: 0,
  bezelV: 0,
  screenW: 1920,
  screenH: 1080,
};

beforeEach(() => {
  prisma.screenWallDevice.findFirst.mockReset();
  prisma.device.findFirst.mockReset();
});

describe('screenWallController.getDeviceWallInfo', () => {
  it('returns wall info on first lookup when paramId matches Device.id (PK)', async () => {
    const assignment = { row: 0, col: 0, wall: WALL };
    prisma.screenWallDevice.findFirst.mockResolvedValueOnce(assignment);

    const req = { params: { deviceId: 'device-pk-123' } };
    const res = mockRes();

    await getDeviceWallInfo(req, res);

    // Only the first lookup should fire — fallback must not run.
    expect(prisma.screenWallDevice.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.screenWallDevice.findFirst).toHaveBeenCalledWith({
      where: { deviceId: 'device-pk-123' },
      include: { wall: true },
    });
    expect(prisma.device.findFirst).not.toHaveBeenCalled();

    expect(res.statusCode).toBe(200);
    expect(res.body.inWall).toBe(true);
    expect(res.body.wallId).toBe('wall-1');
    expect(res.body.row).toBe(0);
    expect(res.body.col).toBe(0);
    expect(res.body.transform).toBeDefined();
  });

  it('falls back to Device.deviceId (Player UUID) when first lookup returns null', async () => {
    const playerUuid = 'a1b2c3d4-uuid-from-player';
    const device = { id: 'device-pk-999', deviceId: playerUuid };
    const assignment = { row: 1, col: 0, wall: WALL };

    prisma.screenWallDevice.findFirst
      .mockResolvedValueOnce(null) // 1st: PK lookup misses
      .mockResolvedValueOnce(assignment); // 2nd: by resolved device.id hits
    prisma.device.findFirst.mockResolvedValueOnce(device);

    const req = { params: { deviceId: playerUuid } };
    const res = mockRes();

    await getDeviceWallInfo(req, res);

    // Critical regression assertion: the 2-step fallback must execute.
    expect(prisma.screenWallDevice.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.device.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { deviceId: playerUuid },
    });
    expect(prisma.screenWallDevice.findFirst).toHaveBeenNthCalledWith(2, {
      where: { deviceId: 'device-pk-999' },
      include: { wall: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.inWall).toBe(true);
    expect(res.body.row).toBe(1);
    expect(res.body.col).toBe(0);
  });

  it('returns { inWall: false } when neither PK nor Player UUID resolves', async () => {
    prisma.screenWallDevice.findFirst.mockResolvedValueOnce(null);
    prisma.device.findFirst.mockResolvedValueOnce(null);

    const req = { params: { deviceId: 'unknown-id' } };
    const res = mockRes();

    await getDeviceWallInfo(req, res);

    expect(prisma.device.findFirst).toHaveBeenCalledTimes(1);
    // Second screenWallDevice query is skipped because device lookup failed.
    expect(prisma.screenWallDevice.findFirst).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ inWall: false });
  });

  it('returns { inWall: false } when device exists but is not assigned to any wall', async () => {
    const device = { id: 'device-pk-555', deviceId: 'orphan-uuid' };

    prisma.screenWallDevice.findFirst
      .mockResolvedValueOnce(null) // 1st: PK miss
      .mockResolvedValueOnce(null); // 2nd: device.id miss
    prisma.device.findFirst.mockResolvedValueOnce(device);

    const req = { params: { deviceId: 'orphan-uuid' } };
    const res = mockRes();

    await getDeviceWallInfo(req, res);

    expect(prisma.screenWallDevice.findFirst).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ inWall: false });
  });

  it('returns 500 when Prisma throws an unexpected error', async () => {
    prisma.screenWallDevice.findFirst.mockRejectedValueOnce(new Error('DB down'));

    const req = { params: { deviceId: 'any' } };
    const res = mockRes();

    await getDeviceWallInfo(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
