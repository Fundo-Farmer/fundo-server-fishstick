const express = require('express');
const { getPayment, simulate, retry } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/:id', getPayment);
router.post('/:id/retry', retry);
router.post('/:id/simulate', simulate); // dev/demo only — blocked in production inside the controller

module.exports = router;
