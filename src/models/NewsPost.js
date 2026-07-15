const mongoose = require('mongoose');
const { CONTENT_STATUS, NEWS_CATEGORY } = require('../config/constants');

const newsPostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, trim: true },
    body: { type: String, required: true },
    images: [{ type: String }],
    category: { type: String, enum: Object.values(NEWS_CATEGORY), required: true },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

newsPostSchema.index({ status: 1, category: 1, publishedAt: -1 });

module.exports = mongoose.model('NewsPost', newsPostSchema);
