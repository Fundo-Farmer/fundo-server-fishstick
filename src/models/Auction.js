const mongoose = require('mongoose');
const { AUCTION_STATUS } = require('../config/constants');

const auctionSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ['livestock', 'coffee', 'pets', 'plantation', 'produce', 'other'],
      required: true,
    },
    images: [{ type: String }],
    startingPrice: { type: Number, required: true },
    bidIncrement: { type: Number, default: 1000 },
    currentPrice: { type: Number, required: true },
    highestBid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(AUCTION_STATUS),
      default: AUCTION_STATUS.SCHEDULED,
    },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

auctionSchema.index({ status: 1, endTime: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
