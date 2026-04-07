jest.mock('../../../src/utils/prisma', () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
}));

const { basicHealth, detailedHealth } = require('../../../src/controllers/healthController');

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

describe('healthController', () => {
  describe('basicHealth', () => {
    it('returns status ok with timestamp', async () => {
      const req = {};
      const res = mockRes();

      await basicHealth(req, res);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });
  });

  describe('detailedHealth', () => {
    it('returns all expected check sections when DB is healthy', async () => {
      const prisma = require('../../../src/utils/prisma');
      prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const req = {};
      const res = mockRes();

      await detailedHealth(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('environment');
      expect(res.body.checks).toHaveProperty('database');
      expect(res.body.checks.database.status).toBe('ok');
      expect(res.body.checks.database).toHaveProperty('responseTime');
      expect(res.body.checks).toHaveProperty('memory');
      expect(res.body.checks.memory).toHaveProperty('heapUsed');
      expect(res.body.checks.memory).toHaveProperty('heapTotal');
      expect(res.body.checks.memory).toHaveProperty('rss');
      expect(res.body.checks).toHaveProperty('system');
      expect(res.body.checks.system).toHaveProperty('platform');
      expect(res.body.checks.system).toHaveProperty('cpus');
      expect(res.body.checks).toHaveProperty('storage');
    });

    it('returns degraded status with 503 when DB is down', async () => {
      const prisma = require('../../../src/utils/prisma');
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const req = {};
      const res = mockRes();

      await detailedHealth(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.database.status).toBe('error');
      expect(res.body.checks.database.message).toBe('Connection refused');
    });

    it('includes websocket info when req.io is available', async () => {
      const prisma = require('../../../src/utils/prisma');
      prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const req = {
        io: {
          fetchSockets: jest.fn().mockResolvedValue([{}, {}]),
        },
      };
      const res = mockRes();

      await detailedHealth(req, res);

      expect(res.body.checks.websocket).toEqual({
        status: 'ok',
        connections: 2,
      });
    });
  });
});
