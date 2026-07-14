const asyncHandler = require('express-async-handler');
const WalletTransaction = require('../models/WalletTransaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { getOrCreateWallet, requestWithdrawal, resolveWithdrawal } = require('../utils/walletService');

// @desc  My wallet balance
// @route GET /api/wallet
const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  res.json({ success: true, data: wallet });
});

// @desc  My wallet ledger (paginated)
// @route GET /api/wallet/transactions
const listMyTransactions = asyncHandler(async (req, res) => {
  const txns = await WalletTransaction.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('order', 'total')
    .populate('withdrawal', 'amount destination status');
  res.json({ success: true, data: txns });
});

// @desc  Request a withdrawal from my available balance
// @route POST /api/wallet/withdraw
const createWithdrawal = asyncHandler(async (req, res) => {
  const { amount, method, destination } = req.body;
  if (!amount || !method || !destination) {
    res.status(400);
    throw new Error('Amount, method and destination are required.');
  }
  const withdrawal = await requestWithdrawal(WithdrawalRequest, req.user, { amount: Number(amount), method, destination });
  res.status(201).json({ success: true, data: withdrawal });
});

// @desc  My withdrawal history
// @route GET /api/wallet/withdrawals
const listMyWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await WithdrawalRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: withdrawals });
});

// @desc  (Super admin) list withdrawal requests platform-wide
// @route GET /api/wallet/admin/withdrawals
const listAllWithdrawals = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const withdrawals = await WithdrawalRequest.find(filter).populate('user', 'name email phone').sort({ createdAt: -1 });
  res.json({ success: true, data: withdrawals });
});

// @desc  (Super admin) approve or reject a withdrawal request
// @route PUT /api/wallet/admin/withdrawals/:id
const processWithdrawal = asyncHandler(async (req, res) => {
  const withdrawal = await WithdrawalRequest.findById(req.params.id);
  if (!withdrawal) {
    res.status(404);
    throw new Error('Withdrawal request not found.');
  }
  if (withdrawal.status !== 'pending') {
    res.status(400);
    throw new Error('This withdrawal has already been processed.');
  }
  const approve = req.body.action === 'approve';
  const updated = await resolveWithdrawal(withdrawal, approve, req.user._id, req.body.note);
  res.json({ success: true, data: updated });
});

module.exports = {
  getMyWallet,
  listMyTransactions,
  createWithdrawal,
  listMyWithdrawals,
  listAllWithdrawals,
  processWithdrawal,
};
