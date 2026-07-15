const mongoose = require('mongoose');
const { CONTENT_STATUS } = require('../config/constants');

const eventSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    images: [{ type: String }],
    location: { type: String, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED },
  },
  { timestamps: true }
);

eventSchema.index({ status: 1, startAt: 1 });

module.exports = mongoose.model('Event', eventSchema);
