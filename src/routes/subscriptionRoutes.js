const express = require('express');
const { createSubscription, listMine, listSelling, pause, resume, cancelSubscription } = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/', createSubscription);
router.get('/mine', listMine);
router.get('/selling', listSelling);
router.put('/:id/pause', pause);
router.put('/:id/resume', resume);
router.put('/:id/cancel', cancelSubscription);

module.exports = router;
