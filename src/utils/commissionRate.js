const User = require('../models/User');
const FarmPremiumSubscription = require('../models/FarmPremiumSubscription');
const { PLATFORM_COMMISSION_PERCENT, PREMIUM_PLAN, FARM_PREMIUM_STATUS } = require('../config/constants');

/**
 * A farm on the Premium plan pays a lower commission on every sale — a real,
 * tangible reason to subscribe, not just a badge. Falls back to the standard
 * rate for sellers with no farm (plain customers) or no active subscription.
 */
const getCommissionPercentForSeller = async (sellerId) => {
  const seller = await User.findById(sellerId).select('farm');
  if (!seller?.farm) return PLATFORM_COMMISSION_PERCENT;

  const premium = await FarmPremiumSubscription.findOne({ farm: seller.farm, status: FARM_PREMIUM_STATUS.ACTIVE });
  return premium ? PREMIUM_PLAN.COMMISSION_PERCENT : PLATFORM_COMMISSION_PERCENT;
};

module.exports = { getCommissionPercentForSeller };
