const express = require('express');
const ctrl = require('../controllers/researchController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');
const upload = require('../middleware/upload');

const router = express.Router();

// Public — note /publications/mine must be registered before /publications/:id
router.get('/publications/mine', protect, ctrl.myPublications);
router.get('/publications', ctrl.browsePublications);
router.get('/publications/:id', ctrl.getPublication);
router.post('/applications', ctrl.submitApplication);
router.post('/applications/:id/attachments', upload.array('attachments', 5), ctrl.uploadApplicationAttachments);

// Researcher (own publications)
router.post('/publications', protect, ctrl.createPublication);
router.put('/publications/:id', protect, ctrl.updatePublication);
router.post('/publications/:id/photos', protect, upload.array('photos', 10), ctrl.uploadPublicationPhotos);
router.delete('/publications/:id', protect, ctrl.deletePublication);

// Admin: review applications
router.get('/applications', protect, requireSuperAdmin, ctrl.listApplications);
router.put('/applications/:id/approve', protect, requireSuperAdmin, ctrl.approveApplication);
router.put('/applications/:id/reject', protect, requireSuperAdmin, ctrl.rejectApplication);

module.exports = router;
