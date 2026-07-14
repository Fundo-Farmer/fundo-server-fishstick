const express = require('express');
const { registerFarm, registerCustomer, login, getMe, updateMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register-farm', registerFarm);
router.post('/register', registerCustomer);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
