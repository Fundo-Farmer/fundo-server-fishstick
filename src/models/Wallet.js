const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Held in escrow: payment has been received but the order isn't fulfilled yet.
    balancePending: { type: Number, default: 0 },
    // Released after fulfillment; can be withdrawn.
    balanceAvailable: { type: Number, default: 0 },
    // Earmarked against an open withdrawal request (removed from "available" so it
    // can't be requested twice, but not yet actually paid out).
    balanceLocked: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 }, // lifetime, for stats — never decreases
    totalWithdrawn: { type: Number, default: 0 },
    currency: { type: String, default: 'UGX' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);
