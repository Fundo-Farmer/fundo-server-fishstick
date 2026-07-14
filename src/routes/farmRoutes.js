const express = require('express');
const {
  listFarms, getFarm, getPublicFarm, getStorefront, updateFarm, setFarmStatus, uploadLogo,
  requestVerification, uploadVerificationDocuments, listPendingVerifications, reviewVerification,
} = require('../controllers/farmController');
const { protect, optionalAuth } = require('../middleware/auth');
const { requireFarmManager, requireSuperAdmin } = require('../middleware/roles');
const upload = require('../middleware/upload');

const router = express.Router();

// Public trust-display routes (no auth required — shown on marketplace listings)
router.get('/:id/public', optionalAuth, getPublicFarm);
router.get('/:id/storefront', optionalAuth, getStorefront);

router.use(protect);
router.get('/', listFarms);
router.get('/verification/pending', requireSuperAdmin, listPendingVerifications);
router.get('/:id', getFarm);
router.put('/:id', requireFarmManager, updateFarm);
router.put('/:id/status', requireSuperAdmin, setFarmStatus);
router.post('/:id/logo', requireFarmManager, upload.single('logo'), uploadLogo);
router.post('/:id/verification/request', requireFarmManager, requestVerification);
router.post('/:id/verification/documents', requireFarmManager, upload.array('documents', 6), uploadVerificationDocuments);
router.put('/:id/verification/review', requireSuperAdmin, reviewVerification);

module.exports = router;
