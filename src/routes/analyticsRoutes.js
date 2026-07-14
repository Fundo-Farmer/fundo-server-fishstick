const express = require('express');
const { getFarmAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { requireFarmStaff } = require('../middleware/roles');

const router = express.Router();

router.get('/farm', protect, requireFarmStaff, getFarmAnalytics);

module.exports = router;
