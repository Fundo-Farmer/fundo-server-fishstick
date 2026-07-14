const mongoose = require('mongoose');

const ussdSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    phoneNumber: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    menu: { type: String, default: 'main' },
    // Scratch space for whatever the current menu needs to remember between
    // steps — e.g. the category chosen, the cached list of listing IDs shown
    // (so picking "2" means something consistent), a pending order total, etc.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// USSD sessions are short-lived (a user rarely takes more than a couple of
// minutes to navigate a menu) — auto-expire abandoned ones after 10 minutes
// rather than accumulating stale session documents forever.
ussdSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('UssdSession', ussdSessionSchema);
