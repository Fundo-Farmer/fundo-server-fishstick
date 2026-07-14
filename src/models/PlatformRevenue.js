const mongoose = require('mongoose');
const { PLATFORM_REVENUE_TYPE } = require('../config/constants');

const platformRevenueSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(PLATFORM_REVENUE_TYPE), required: true, index: true },
    amount: { type: Number, required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    preOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PreOrder', default: null },
    marketItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketItem', default: null },
    description: { type: String, trim: true },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

platformRevenueSchema.index({ type: 1, date: -1 });

module.exports = mongoose.model('PlatformRevenue', platformRevenueSchema);
