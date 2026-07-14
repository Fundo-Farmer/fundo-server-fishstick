const express = require('express');
const ctrl = require('../controllers/auctionController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public browsing
router.get('/', optionalAuth, ctrl.listAuctions);
router.get('/mine', protect, ctrl.myAuctions);
router.get('/:id', ctrl.getAuction);

// Authenticated selling & bidding
router.post('/', protect, ctrl.createAuction);
router.post('/:id/photos', protect, upload.array('photos', 10), ctrl.uploadPhotos);
router.post('/:id/bids', protect, ctrl.placeBid);
router.put('/:id/cancel', protect, ctrl.cancelAuction);

module.exports = router;
