const express = require('express');
const ctrl = require('../controllers/eventsController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/mine/all', protect, ctrl.myEvents);
router.get('/', ctrl.browseEvents);
router.get('/:id', ctrl.getEvent);
router.post('/', protect, ctrl.createEvent);
router.put('/:id', protect, ctrl.updateEvent);
router.post('/:id/photos', protect, upload.array('photos', 10), ctrl.uploadEventPhotos);
router.delete('/:id', protect, ctrl.deleteEvent);

module.exports = router;
