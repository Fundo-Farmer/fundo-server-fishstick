const mongoose = require('mongoose');
const { ORDER_STATUS, FULFILLMENT_TYPE, ORDER_PAYMENT_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema(
  {
    marketItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketItem', required: true },
    title: { type: String, required: true },
    image: { type: String, default: null },
    priceEach: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'unit' },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Ties together the sibling orders created from a single checkout action
    // (one checkout can produce several orders if the cart spans multiple sellers).
    groupId: { type: String, index: true },

    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },

    // Payment & escrow
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    paymentStatus: { type: String, enum: Object.values(ORDER_PAYMENT_STATUS), default: ORDER_PAYMENT_STATUS.UNPAID },
    commissionAmount: { type: Number, default: 0 },
    sellerAmount: { type: Number, default: 0 }, // total minus platform commission
    escrowReleased: { type: Boolean, default: false },

    fulfillmentType: { type: String, enum: Object.values(FULFILLMENT_TYPE), required: true },
    deliveryAddress: { type: String, trim: true },
    // Optional — set via the map picker at checkout. Without it, delivery pricing
    // falls back to a flat fee instead of distance-based (see utils/geo.js).
    deliveryCoordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },
    pickupNote: { type: String, trim: true },
    buyerContact: { type: String, trim: true },
    buyerNotes: { type: String, trim: true },

    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PLACED },
    statusHistory: { type: [statusEventSchema], default: () => [{ status: ORDER_STATUS.PLACED }] },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true }
);

orderSchema.index({ seller: 1, status: 1, createdAt: -1 });
orderSchema.index({ buyer: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
