const crypto = require('crypto');

/**
 * Validate required environment variables and warn about security issues.
 * Called once during app startup.
 */
function validateEnv() {
  const errors = [];
  const warnings = [];

  // Required variables
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // JWT_SECRET security check
  if (process.env.JWT_SECRET) {
    const secret = process.env.JWT_SECRET;
    if (secret.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters for security');
    }
    if (secret.includes('signflow-super-secret') || secret.includes('change-me')) {
      if (process.env.NODE_ENV === 'production') {
        errors.push('JWT_SECRET must be changed from default value in production');
      } else {
        warnings.push('JWT_SECRET is using default value - change before deploying to production');
      }
    }
  }

  // Port validation
  const port = parseInt(process.env.PORT || '3001');
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT}`);
  }

  // NODE_ENV validation
  const validEnvs = ['development', 'test', 'staging', 'production'];
  if (process.env.NODE_ENV && !validEnvs.includes(process.env.NODE_ENV)) {
    warnings.push(`Unknown NODE_ENV: ${process.env.NODE_ENV}`);
  }

  // R2 storage validation (if partially configured)
  const r2Vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
  const configuredR2 = r2Vars.filter(v => process.env[v]);
  if (configuredR2.length > 0 && configuredR2.length < r2Vars.length) {
    const missing = r2Vars.filter(v => !process.env[v]);
    warnings.push(`R2 storage partially configured. Missing: ${missing.join(', ')}`);
  }

  return { errors, warnings };
}

/**
 * Generate a cryptographically secure JWT secret.
 */
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = { validateEnv, generateSecret };
