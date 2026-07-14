const mongoose = require('mongoose');
const { FARM_PREMIUM_STATUS, PAYMENT_METHOD, PAYMENT_PROVIDER } = require('../config/constants');

const farmPremiumSubscriptionSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, unique: true },
    subscribedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: { type: String, enum: Object.values(FARM_PREMIUM_STATUS), default: FARM_PREMIUM_STATUS.ACTIVE },
    amount: { type: Number, required: true },

    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    paymentProvider: { type: String, enum: Object.values(PAYMENT_PROVIDER) },
    phoneNumber: { type: String, trim: true },
    providerRef: { type: String, trim: true }, // set while a billing attempt is pending

    nextBillingAt: { type: Date, required: true },
    lastBilledAt: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FarmPremiumSubscription', farmPremiumSubscriptionSchema);
