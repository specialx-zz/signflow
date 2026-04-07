/**
 * testApp.js — Provide a shared Express app instance for integration tests.
 *
 * Environment variables are set by tests/setup.js (loaded via jest setupFiles)
 * before this module is ever required. The app detects NODE_ENV === 'test' and
 * skips server.listen(), so supertest can bind its own ephemeral port.
 */

let _app = null;

function getTestApp() {
  if (_app) return _app;

  // Require the real Express app (which reads DATABASE_URL from env)
  const { app } = require('../../src/app');
  _app = app;
  return app;
}

module.exports = { getTestApp };
