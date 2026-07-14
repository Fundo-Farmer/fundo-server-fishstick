const express = require('express');
const { listAvailable, claimDelivery, updateDeliveryStatus, myDeliveries } = require('../controllers/deliveryController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/available', listAvailable);
router.get('/mine', myDeliveries);
router.post('/:id/claim', claimDelivery);
router.put('/:id/status', updateDeliveryStatus);

module.exports = router;
