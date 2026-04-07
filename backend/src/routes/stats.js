const express = require('express');
const router = express.Router();
const { getDashboardStats, getContentStats, getDeviceStats, getDailyReport, getWeeklyTrend, getDeviceUptime, getContentPerformance } = require('../controllers/statsController');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

router.get('/dashboard', getDashboardStats);
router.get('/content', getContentStats);
router.get('/devices', getDeviceStats);
router.get('/report/daily', getDailyReport);
router.get('/report/weekly', getWeeklyTrend);
router.get('/report/devices', getDeviceUptime);
router.get('/report/content', getContentPerformance);

module.exports = router;
