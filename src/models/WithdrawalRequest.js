const mongoose = require('mongoose');
const { WITHDRAWAL_STATUS, PAYMENT_METHOD } = require('../config/constants');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    destination: { type: String, required: true, trim: true }, // phone number or bank account
    status: { type: String, enum: Object.values(WITHDRAWAL_STATUS), default: WITHDRAWAL_STATUS.PENDING },
    note: { type: String, trim: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
