const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['privacy_policy', 'terms_conditions', 'marketplace_policy', 'legal', 'about', 'careers', 'academy'],
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true }, // markdown
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
