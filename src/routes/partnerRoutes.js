const express = require('express');
const { listPartners, listAllPartners, createPartner, updatePartner, deletePartner } = require('../controllers/partnerController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/', listPartners);
router.get('/all', protect, requireSuperAdmin, listAllPartners);
router.post('/', protect, requireSuperAdmin, upload.single('logo'), createPartner);
router.put('/:id', protect, requireSuperAdmin, upload.single('logo'), updatePartner);
router.delete('/:id', protect, requireSuperAdmin, deletePartner);

module.exports = router;
