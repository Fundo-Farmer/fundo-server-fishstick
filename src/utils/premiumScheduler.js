const cron = require('node-cron');
const FarmPremiumSubscription = require('../models/FarmPremiumSubscription');
const { getProvider } = require('./paymentProviders');
const { handlePremiumPaymentCallback } = require('./premiumService');
const notify = require('./notify');
const { FARM_PREMIUM_STATUS } = require('../config/constants');

/**
 * Charges every active Premium subscription whose `nextBillingAt` has passed.
 * A failed attempt doesn't cancel the plan outright — see
 * PREMIUM_PLAN.MAX_CONSECUTIVE_FAILURES in handlePremiumPaymentCallback.
 */
const runDuePremiumBilling = async () => {
  const due = await FarmPremiumSubscription.find({
    status: FARM_PREMIUM_STATUS.ACTIVE,
    nextBillingAt: { $lte: new Date() },
    providerRef: null, // don't double-charge a subscription with a payment already in flight
  });

  for (const sub of due) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { providerRef } = await getProvider(sub.paymentProvider).initiate({
        phoneNumber: sub.phoneNumber,
        onResolve: handlePremiumPaymentCallback,
      });
      sub.providerRef = providerRef;
      // eslint-disable-next-line no-await-in-loop
      await sub.save();
      // eslint-disable-next-line no-await-in-loop
      await notify(sub.subscribedBy, {
        type: 'premium_billing_started',
        title: 'Premium plan renewing',
        body: `Charging UGX ${sub.amount.toLocaleString()} for your monthly Premium plan — check your phone to approve.`,
        link: '/dashboard/premium',
        sms: true,
      });
    } catch (err) {
      console.error('[fundo] premium billing error for farm', sub.farm, err.message);
    }
  }
};

const startPremiumScheduler = () => {
  // Once a day is plenty for monthly billing.
  cron.schedule('0 6 * * *', () => {
    runDuePremiumBilling().catch((err) => console.error('[fundo] premium scheduler error:', err.message));
  });
};

module.exports = { startPremiumScheduler, runDuePremiumBilling };
