const express = require('express');
const ctrl = require('../controllers/newsController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/mine/all', protect, ctrl.myNews);
router.get('/', ctrl.browseNews);
router.get('/:id', ctrl.getNewsPost);
router.post('/', protect, ctrl.createNewsPost);
router.put('/:id', protect, ctrl.updateNewsPost);
router.post('/:id/photos', protect, upload.array('photos', 10), ctrl.uploadNewsPhotos);
router.delete('/:id', protect, ctrl.deleteNewsPost);

module.exports = router;
