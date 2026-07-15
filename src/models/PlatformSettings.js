const mongoose = require('mongoose');

// A single document holds every admin-tunable business setting. Seeded from
// the env-var defaults in config/constants.js the first time it's read (see
// utils/settingsService.js) so existing deployments don't need a migration —
// the env vars become the *initial* values, editable from the admin panel
// from then on.
const platformSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true },

    platformCommissionPercent: { type: Number, required: true },

    deliveryPricing: {
      localRadiusKm: { type: Number, required: true },
      localBaseFee: { type: Number, required: true },
      localFeePerKm: { type: Number, required: true },
      longHaulBaseFee: { type: Number, required: true },
      longHaulFeePerKm: { type: Number, required: true },
      fallbackFlatFee: { type: Number, required: true },
      longHaulKmPerDay: { type: Number, required: true },
    },
    maxDeliveryReassignments: { type: Number, required: true },
    maxSubscriptionSkips: { type: Number, required: true },

    featuredListing: {
      fee: { type: Number, required: true },
      days: { type: Number, required: true },
    },
    premiumPlan: {
      monthlyFee: { type: Number, required: true },
      commissionPercent: { type: Number, required: true },
      maxConsecutiveFailures: { type: Number, required: true },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
