const express = require('express');
const {
  registerCourier, getMyCourierProfile, updateMyCourierProfile, setAvailability,
  requestVerification, uploadVerificationDocuments, listPendingVerifications, listCouriers, reviewVerification,
} = require('../controllers/courierController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(protect);

router.post('/register', registerCourier);
router.get('/me', getMyCourierProfile);
router.put('/me', updateMyCourierProfile);
router.put('/me/availability', setAvailability);
router.post('/me/verification/request', requestVerification);
router.post('/me/verification/documents', upload.array('documents', 6), uploadVerificationDocuments);

// Super admin: KYC review queue
router.get('/verification/pending', requireSuperAdmin, listPendingVerifications);
router.get('/', requireSuperAdmin, listCouriers);
router.put('/:id/verification/review', requireSuperAdmin, reviewVerification);

module.exports = router;
