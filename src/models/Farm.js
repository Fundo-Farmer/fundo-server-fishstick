const mongoose = require('mongoose');
const { FARM_VERIFICATION_STATUS } = require('../config/constants');

const farmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    location: { type: String, trim: true },
    // Optional — set from a map picker in Settings. Without it, deliveries from
    // this farm fall back to a flat fee instead of distance-based pricing.
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    modulesEnabled: {
      livestock: { type: Boolean, default: true },
      coffee: { type: Boolean, default: true },
      pets: { type: Boolean, default: true },
      plantation: { type: Boolean, default: true },
    },
    config: {
      logo: { type: String, default: null },
      themeColor: { type: String, default: '#1F3D2B' },
      accentColor: { type: String, default: '#C98A2C' },
      displayName: { type: String, default: '' },
      currency: { type: String, default: 'UGX' },
    },
    // Admin-reviewed trust signal — the one badge a farm can't just self-declare.
    verification: {
      status: { type: String, enum: Object.values(FARM_VERIFICATION_STATUS), default: FARM_VERIFICATION_STATUS.UNVERIFIED },
      requestNote: { type: String, trim: true }, // what the farm submitted for review
      documents: [{ type: String }], // supporting photo/document uploads
      requestedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewNote: { type: String, trim: true }, // admin's note, whether approving or rejecting
    },
    // Admin-curated, shown alongside the verification badge (distinct from a
    // listing's self-declared qualityTags — see MarketItem).
    certifications: [{ type: String, trim: true }],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Farm', farmSchema);
