const express = require('express');
const { listMine, add, remove } = require('../controllers/wishlistController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', listMine);
router.post('/:marketItemId', add);
router.delete('/:marketItemId', remove);

module.exports = router;
