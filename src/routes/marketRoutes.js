const express = require('express');
const ctrl = require('../controllers/marketController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public browsing
router.get('/', optionalAuth, ctrl.browseListings);
router.get('/mine', protect, ctrl.myListings);
router.get('/sources', protect, ctrl.listSellableSources);
router.get('/:id', ctrl.getListing);
router.get('/:id/provenance', ctrl.getProvenance);

// Authenticated selling
router.post('/', protect, ctrl.createListing);
router.post('/:id/photos', protect, upload.array('photos', 10), ctrl.uploadPhotos);
router.put('/:id', protect, ctrl.updateListing);
router.delete('/:id', protect, ctrl.deleteListing);
router.post('/:id/feature', protect, ctrl.featureListing);
router.post('/:id/feature/simulate', protect, ctrl.simulateFeaturePayment);

module.exports = router;
