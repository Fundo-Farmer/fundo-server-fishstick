const express = require('express');
const { getPlatformStats, getPlatformAnalytics } = require('../controllers/adminController');
const { getPlatformSettings, updatePlatformSettings } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');

const router = express.Router();

router.use(protect, requireSuperAdmin);
router.get('/stats', getPlatformStats);
router.get('/analytics', getPlatformAnalytics);
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);

module.exports = router;
