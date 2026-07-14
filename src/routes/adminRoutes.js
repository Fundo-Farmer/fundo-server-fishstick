const express = require('express');
const { getPlatformStats, getPlatformAnalytics } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');

const router = express.Router();

router.use(protect, requireSuperAdmin);
router.get('/stats', getPlatformStats);
router.get('/analytics', getPlatformAnalytics);

module.exports = router;
