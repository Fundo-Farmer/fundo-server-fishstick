const mongoose = require('mongoose');
const { PAYMENT_METHOD, PAYMENT_PROVIDER, PAYMENT_STATUS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupId: { type: String, index: true }, // matches Order.groupId for the same checkout
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],

    amount: { type: Number, required: true },
    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    provider: { type: String, enum: Object.values(PAYMENT_PROVIDER), required: true },
    phoneNumber: { type: String, trim: true }, // for mobile money
    providerRef: { type: String, trim: true }, // the provider's own transaction reference

    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    failureReason: { type: String, trim: true },
    initiatedAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
