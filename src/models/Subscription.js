const mongoose = require('mongoose');
const { SUBSCRIPTION_FREQUENCY, SUBSCRIPTION_STATUS, FULFILLMENT_TYPE, PAYMENT_METHOD } = require('../config/constants');

const subscriptionSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    marketItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketItem', required: true },

    quantity: { type: Number, required: true, min: 1 },
    frequency: { type: String, enum: Object.values(SUBSCRIPTION_FREQUENCY), required: true },

    fulfillmentType: { type: String, enum: Object.values(FULFILLMENT_TYPE), required: true },
    deliveryAddress: { type: String, trim: true },
    deliveryCoordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    pickupNote: { type: String, trim: true },
    buyerContact: { type: String, trim: true },

    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    paymentProvider: { type: String, trim: true }, // 'mtn' | 'airtel', for mobile money
    phoneNumber: { type: String, trim: true },

    status: { type: String, enum: Object.values(SUBSCRIPTION_STATUS), default: SUBSCRIPTION_STATUS.ACTIVE },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date, default: null },
    lastOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    consecutiveSkips: { type: Number, default: 0 }, // auto-paused after too many (e.g. listing gone)
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1, nextRunAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
