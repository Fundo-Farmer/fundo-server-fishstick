const mongoose = require('mongoose');
const { REVIEW_DIRECTION } = require('../config/constants');

const reviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    direction: { type: String, enum: Object.values(REVIEW_DIRECTION), required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null }, // reviewee's farm, if any, for farm-level aggregates
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

// One review per order per direction — you can't review the same order twice.
reviewSchema.index({ order: 1, direction: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
