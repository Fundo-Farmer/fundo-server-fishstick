const mongoose = require('mongoose');
const { LISTING_STATUS } = require('../config/constants');

const marketItemSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    // Optional link back to the farm record this listing represents, so a sale can
    // automatically update the farm's own records (e.g. mark an animal as sold),
    // and so buyers can see where it actually came from. HarvestRecord/ProduceRecord
    // trace to a specific batch (e.g. "harvested 12 Jul from Kanyanya Plot"); the
    // others trace to the animal or plot itself.
    sourceType: {
      type: String,
      enum: ['Livestock', 'Pet', 'CoffeeGarden', 'Plantation', 'HarvestRecord', 'ProduceRecord', null],
      default: null,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'sourceType', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ['livestock', 'coffee', 'pets', 'plantation', 'produce', 'other'],
      required: true,
    },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'unit' },
    location: { type: String, trim: true },
    images: [{ type: String }],
    // Self-declared, per-listing (e.g. "Grade A", "Organic") — distinct from the
    // farm-level verification badge, which is admin-reviewed.
    qualityTags: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: Object.values(LISTING_STATUS),
      default: LISTING_STATUS.AVAILABLE,
    },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date, default: null }, // when the paid featuring window ends
    featurePaymentRef: { type: String, default: null }, // provider ref while a featuring payment is pending
  },
  { timestamps: true }
);

marketItemSchema.index({ status: 1, category: 1, createdAt: -1 });
marketItemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('MarketItem', marketItemSchema);
