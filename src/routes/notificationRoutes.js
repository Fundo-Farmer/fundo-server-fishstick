const express = require('express');
const { listMine, markRead, markAllRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', listMine);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

module.exports = router;
