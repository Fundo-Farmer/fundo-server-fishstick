const express = require('express');
const {
  getMyWallet, listMyTransactions, createWithdrawal, listMyWithdrawals, listAllWithdrawals, processWithdrawal,
} = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');

const router = express.Router();
router.use(protect);

router.get('/', getMyWallet);
router.get('/transactions', listMyTransactions);
router.post('/withdraw', createWithdrawal);
router.get('/withdrawals', listMyWithdrawals);

// Platform admin: review & process payout requests
router.get('/admin/withdrawals', requireSuperAdmin, listAllWithdrawals);
router.put('/admin/withdrawals/:id', requireSuperAdmin, processWithdrawal);

module.exports = router;
