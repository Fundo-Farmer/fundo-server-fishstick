const mongoose = require('mongoose');
const { CONTENT_STATUS } = require('../config/constants');

const publicationSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    abstract: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    images: [{ type: String }],
    tags: [{ type: String, trim: true }],
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

publicationSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Publication', publicationSchema);
