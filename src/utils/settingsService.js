const PlatformSettings = require('../models/PlatformSettings');
const {
  PLATFORM_COMMISSION_PERCENT, DELIVERY_PRICING, MAX_DELIVERY_REASSIGNMENTS, MAX_SUBSCRIPTION_SKIPS,
  FEATURED_LISTING, PREMIUM_PLAN,
} = require('../config/constants');

let cached = null;

/**
 * Returns the current platform settings, seeding the singleton document from
 * the env-var defaults in constants.js the very first time this runs (so a
 * fresh deployment doesn't need a manual setup step). Cached in memory after
 * that — call invalidate() (done automatically by updateSettings) after a
 * write so the next read reflects it.
 */
const getSettings = async () => {
  if (cached) return cached;

  let doc = await PlatformSettings.findOne({ singleton: 'main' });
  if (!doc) {
    doc = await PlatformSettings.create({
      singleton: 'main',
      platformCommissionPercent: PLATFORM_COMMISSION_PERCENT,
      deliveryPricing: {
        localRadiusKm: DELIVERY_PRICING.LOCAL_RADIUS_KM,
        localBaseFee: DELIVERY_PRICING.LOCAL_BASE_FEE,
        localFeePerKm: DELIVERY_PRICING.LOCAL_FEE_PER_KM,
        longHaulBaseFee: DELIVERY_PRICING.LONG_HAUL_BASE_FEE,
        longHaulFeePerKm: DELIVERY_PRICING.LONG_HAUL_FEE_PER_KM,
        fallbackFlatFee: DELIVERY_PRICING.FALLBACK_FLAT_FEE,
        longHaulKmPerDay: DELIVERY_PRICING.LONG_HAUL_KM_PER_DAY,
      },
      maxDeliveryReassignments: MAX_DELIVERY_REASSIGNMENTS,
      maxSubscriptionSkips: MAX_SUBSCRIPTION_SKIPS,
      featuredListing: { fee: FEATURED_LISTING.FEE, days: FEATURED_LISTING.DAYS },
      premiumPlan: {
        monthlyFee: PREMIUM_PLAN.MONTHLY_FEE,
        commissionPercent: PREMIUM_PLAN.COMMISSION_PERCENT,
        maxConsecutiveFailures: PREMIUM_PLAN.MAX_CONSECUTIVE_FAILURES,
      },
    });
  }
  cached = doc;
  return doc;
};

const invalidate = () => { cached = null; };

/**
 * Applies a (possibly partial, possibly nested) patch to the settings
 * document and persists it. Used by the admin settings page.
 */
const updateSettings = async (patch, userId) => {
  const doc = await getSettings();
  const merge = (target, source) => {
    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = target[key] || {};
        merge(target[key], value);
      } else if (value !== undefined) {
        target[key] = value;
      }
    });
  };
  merge(doc, patch);
  doc.updatedBy = userId || null;
  await doc.save();
  invalidate();
  return doc;
};

module.exports = { getSettings, updateSettings, invalidate };
