const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    marketItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketItem', required: true },
    priceWhenAdded: { type: Number, required: true },
  },
  { timestamps: true }
);

wishlistItemSchema.index({ user: 1, marketItem: 1 }, { unique: true });

module.exports = mongoose.model('WishlistItem', wishlistItemSchema);
