const User = require('../models/User');
const FarmPremiumSubscription = require('../models/FarmPremiumSubscription');
const { getSettings } = require('./settingsService');
const { FARM_PREMIUM_STATUS } = require('../config/constants');

/**
 * A farm on the Premium plan pays a lower commission on every sale — a real,
 * tangible reason to subscribe, not just a badge. Falls back to the standard
 * rate for sellers with no farm (plain customers) or no active subscription.
 * Both rates are admin-configurable — see utils/settingsService.js.
 */
const getCommissionPercentForSeller = async (sellerId) => {
  const settings = await getSettings();
  const seller = await User.findById(sellerId).select('farm');
  if (!seller?.farm) return settings.platformCommissionPercent;

  const premium = await FarmPremiumSubscription.findOne({ farm: seller.farm, status: FARM_PREMIUM_STATUS.ACTIVE });
  return premium ? settings.premiumPlan.commissionPercent : settings.platformCommissionPercent;
};

module.exports = { getCommissionPercentForSeller };
