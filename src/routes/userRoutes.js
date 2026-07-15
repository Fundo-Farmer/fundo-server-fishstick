const express = require('express');
const { listUsers, createWorker, createPlatformStaff, updateUser, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { requireFarmManager, requireSuperAdmin } = require('../middleware/roles');

const router = express.Router();

router.use(protect);
router.get('/', listUsers);
router.post('/worker', requireFarmManager, createWorker);
router.post('/platform-staff', requireSuperAdmin, createPlatformStaff);
router.put('/:id', requireFarmManager, updateUser);
router.delete('/:id', requireFarmManager, deleteUser);

module.exports = router;
