const express = require('express');
const ctrl = require('../controllers/coffeeGardenController');
const { protect } = require('../middleware/auth');
const { requireFarmStaff } = require('../middleware/roles');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect, requireFarmStaff);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/photos', upload.array('photos', 10), ctrl.uploadPhotos);

module.exports = router;
