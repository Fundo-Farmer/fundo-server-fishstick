const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, index: true },
    bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

bidSchema.index({ auction: 1, amount: -1 });

module.exports = mongoose.model('Bid', bidSchema);
