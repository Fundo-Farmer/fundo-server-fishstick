const express = require('express');
const { getStatus, subscribe, cancel, simulatePayment } = require('../controllers/premiumController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/status', getStatus);
router.post('/subscribe', subscribe);
router.put('/cancel', cancel);
router.post('/simulate', simulatePayment);

module.exports = router;
