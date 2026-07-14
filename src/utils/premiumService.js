const FarmPremiumSubscription = require('../models/FarmPremiumSubscription');
const PlatformRevenue = require('../models/PlatformRevenue');
const notify = require('./notify');
const { PAYMENT_STATUS, FARM_PREMIUM_STATUS, PLATFORM_REVENUE_TYPE, PREMIUM_PLAN } = require('../config/constants');

/**
 * Advances a date by one month, then keeps advancing past any additional
 * missed months until the result is actually in the future — the same fix
 * applied to the buyer-subscription scheduler in Phase 6, for the same
 * reason: if billing were ever delayed by more than one cycle, naively
 * adding one month could still land in the past and re-trigger immediately.
 */
const nextMonthlyBillingAfter = (from) => {
  let next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  while (next <= new Date()) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
};

/**
 * Shared entrypoint for the mock provider (and, eventually, a real webhook)
 * to report a premium-billing payment's outcome.
 */
const handlePremiumPaymentCallback = async (providerRef, outcome) => {
  const sub = await FarmPremiumSubscription.findOne({ providerRef });
  if (!sub) return;

  if (outcome === PAYMENT_STATUS.SUCCESSFUL) {
    sub.status = FARM_PREMIUM_STATUS.ACTIVE;
    sub.lastBilledAt = new Date();
    sub.nextBillingAt = nextMonthlyBillingAfter(sub.nextBillingAt < new Date() ? new Date() : sub.nextBillingAt);
    sub.consecutiveFailures = 0;
    sub.providerRef = null;
    await sub.save();

    await PlatformRevenue.create({
      type: PLATFORM_REVENUE_TYPE.PREMIUM_SUBSCRIPTION,
      amount: sub.amount,
      farm: sub.farm,
      description: 'Premium farm subscription',
    });

    await notify(sub.subscribedBy, {
      type: 'premium_active',
      title: 'Premium plan active',
      body: `Your farm is now on the Premium plan — ${PREMIUM_PLAN.COMMISSION_PERCENT}% commission on every sale.`,
      link: '/dashboard/premium',
      sms: true,
    });
  } else {
    sub.consecutiveFailures += 1;
    sub.providerRef = null;
    if (sub.consecutiveFailures >= PREMIUM_PLAN.MAX_CONSECUTIVE_FAILURES) {
      sub.status = FARM_PREMIUM_STATUS.PAST_DUE;
    }
    await sub.save();

    await notify(sub.subscribedBy, {
      type: 'premium_payment_failed',
      title: 'Premium billing failed',
      body: sub.status === FARM_PREMIUM_STATUS.PAST_DUE
        ? 'Your Premium plan has lapsed after repeated failed payments — resubscribe any time.'
        : "We couldn't process your Premium billing — we'll retry, or you can pay manually.",
      link: '/dashboard/premium',
      sms: true,
    });
  }
};

module.exports = { handlePremiumPaymentCallback, nextMonthlyBillingAfter };
