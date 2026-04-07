// Global test setup — must run before any app module is required
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.PORT = '3099';

// Use the same dev.db that seed.js populates.
// The .env has "file:./prisma/dev.db". Prisma resolves relative paths
// from the prisma/ directory, so this becomes <project>/prisma/prisma/dev.db.
// We must use the same value so the test Prisma client connects to the same DB.
process.env.DATABASE_URL = 'file:./prisma/dev.db';
