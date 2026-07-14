const mongoose = require('mongoose');
const { PREORDER_STATUS, PAYMENT_METHOD, PAYMENT_PROVIDER, PAYMENT_STATUS } = require('../config/constants');

const preOrderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    forecast: { type: mongoose.Schema.Types.ObjectId, ref: 'HarvestForecast', required: true, index: true },

    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true },
    pricePerUnit: { type: Number, required: true }, // locked at the time of the pre-order
    total: { type: Number, required: true },
    commissionAmount: { type: Number, default: 0 },
    sellerAmount: { type: Number, default: 0 },
    escrowReleased: { type: Boolean, default: false },

    fulfillmentType: { type: String, required: true },
    deliveryAddress: { type: String, trim: true },
    deliveryCoordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    pickupNote: { type: String, trim: true },
    buyerContact: { type: String, trim: true },

    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    paymentProvider: { type: String, enum: Object.values(PAYMENT_PROVIDER) },
    phoneNumber: { type: String, trim: true },
    providerRef: { type: String, trim: true },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    failureReason: { type: String, trim: true },

    status: { type: String, enum: Object.values(PREORDER_STATUS), default: PREORDER_STATUS.AWAITING_PAYMENT },
    convertedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

preOrderSchema.pre('validate', function computeTotal(next) {
  if (this.pricePerUnit != null && this.quantity != null) {
    this.total = Number((this.pricePerUnit * this.quantity).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('PreOrder', preOrderSchema);
