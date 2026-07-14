const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true }, // e.g. 'order_placed', 'payment_received', 'escrow_released'
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    link: { type: String, trim: true }, // frontend route to open when clicked
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
