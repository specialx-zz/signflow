/**
 * V4 Phase 14: Tag-based conditional playback & events (facade).
 *
 * Originally a single 358-line module; split into three submodules to stay
 * under the 300-line file size limit and to isolate tenant-verification
 * responsibilities by concern:
 *   - tagPlayback/deviceTags.js       — device tag get/set/update/list
 *   - tagPlayback/scheduleConditions.js — condition CRUD on schedules
 *   - tagPlayback/resolve.js           — tag-matching resolve + device search
 *
 * Route files continue to import from this facade unchanged.
 */

const deviceTags = require('./tagPlayback/deviceTags');
const scheduleConditions = require('./tagPlayback/scheduleConditions');
const resolve = require('./tagPlayback/resolve');

module.exports = {
  ...deviceTags,
  ...scheduleConditions,
  ...resolve,
};
