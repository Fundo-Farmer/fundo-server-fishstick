const express = require('express');
const { listUsers, createWorker, updateUser, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { requireFarmManager } = require('../middleware/roles');

const router = express.Router();

router.use(protect);
router.get('/', listUsers);
router.post('/worker', requireFarmManager, createWorker);
router.put('/:id', requireFarmManager, updateUser);
router.delete('/:id', requireFarmManager, deleteUser);

module.exports = router;
