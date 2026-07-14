const mongoose = require('mongoose');
const { WALLET_TXN_TYPE } = require('../config/constants');

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(WALLET_TXN_TYPE), required: true },
    amount: { type: Number, required: true }, // positive = credit, negative = debit
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: 'WithdrawalRequest', default: null },
    description: { type: String, trim: true },
    balanceAvailableAfter: { type: Number },
    balancePendingAfter: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
