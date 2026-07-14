const express = require('express');
const { createReview, getForOrder, getForUser, getForFarm } = require('../controllers/reviewController');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public — ratings are part of trust signals shown to anyone browsing
router.get('/user/:userId', optionalAuth, getForUser);
router.get('/farm/:farmId', optionalAuth, getForFarm);

router.post('/', protect, createReview);
router.get('/order/:orderId', protect, getForOrder);

module.exports = router;
