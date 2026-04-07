const { PrismaClient } = require('@prisma/client');

// 공유 Prisma 인스턴스 — 모든 컨트롤러/미들웨어에서 이것을 import
const prisma = new PrismaClient();

module.exports = prisma;
