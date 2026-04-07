process.env.NODE_ENV = 'test';

const { validateEnv, generateSecret } = require('../../../src/utils/envValidator');

describe('envValidator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset to minimal valid env
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateEnv', () => {
    test('missing required vars produces errors', () => {
      const { errors } = validateEnv();
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('DATABASE_URL'),
          expect.stringContaining('JWT_SECRET'),
        ])
      );
    });

    test('default JWT_SECRET produces warning in dev', () => {
      process.env.DATABASE_URL = 'file:./prisma/dev.db';
      process.env.JWT_SECRET = 'signflow-super-secret-jwt-key-2024';
      process.env.NODE_ENV = 'development';

      const { warnings, errors } = validateEnv();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('using default value'),
        ])
      );
      // Should not be an error in dev
      expect(errors).not.toEqual(
        expect.arrayContaining([
          expect.stringContaining('must be changed from default'),
        ])
      );
    });

    test('default JWT_SECRET produces error in production', () => {
      process.env.DATABASE_URL = 'file:./prisma/dev.db';
      process.env.JWT_SECRET = 'signflow-super-secret-jwt-key-2024';
      process.env.NODE_ENV = 'production';

      const { errors } = validateEnv();
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('must be changed from default'),
        ])
      );
    });

    test('short JWT_SECRET produces warning', () => {
      process.env.DATABASE_URL = 'file:./prisma/dev.db';
      process.env.JWT_SECRET = 'short';

      const { warnings } = validateEnv();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('at least 32 characters'),
        ])
      );
    });

    test('valid config produces no errors', () => {
      process.env.DATABASE_URL = 'file:./prisma/dev.db';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.PORT = '3001';
      process.env.NODE_ENV = 'development';

      const { errors, warnings } = validateEnv();
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    test('R2 partial config produces warning', () => {
      process.env.DATABASE_URL = 'file:./prisma/dev.db';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.R2_ACCOUNT_ID = 'some-id';
      // Missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

      const { warnings } = validateEnv();
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('R2 storage partially configured'),
        ])
      );
    });

    test('invalid PORT produces error', () => {
      process.env.DATABASE_URL = 'file:./prisma/dev.db';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.PORT = 'not-a-number';

      const { errors } = validateEnv();
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Invalid PORT'),
        ])
      );
    });
  });

  describe('generateSecret', () => {
    test('returns correct length hex string', () => {
      const secret = generateSecret(32);
      // 32 bytes = 64 hex characters
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(/^[0-9a-f]+$/);
    });

    test('default length is 64 bytes (128 hex chars)', () => {
      const secret = generateSecret();
      expect(secret).toHaveLength(128);
      expect(secret).toMatch(/^[0-9a-f]+$/);
    });
  });
});
