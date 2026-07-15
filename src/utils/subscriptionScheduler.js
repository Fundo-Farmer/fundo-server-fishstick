const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const { createSingleItemOrder } = require('./orderCreation');
const notify = require('./notify');
const { getSettings } = require('./settingsService');
const { SUBSCRIPTION_FREQUENCY, SUBSCRIPTION_STATUS } = require('../config/constants');

const computeNextRunAt = (frequency, from = new Date()) => {
  const next = new Date(from);
  switch (frequency) {
    case SUBSCRIPTION_FREQUENCY.DAILY:
      next.setDate(next.getDate() + 1);
      break;
    case SUBSCRIPTION_FREQUENCY.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case SUBSCRIPTION_FREQUENCY.BIWEEKLY:
      next.setDate(next.getDate() + 14);
      break;
    case SUBSCRIPTION_FREQUENCY.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
};

/**
 * Runs every active subscription whose `nextRunAt` has passed. A skipped
 * cycle (listing gone / out of stock) doesn't stop the subscription outright —
 * only after MAX_SUBSCRIPTION_SKIPS in a row does it auto-pause, so a
 * temporarily sold-out listing doesn't silently kill a subscription over one bad cycle.
 */
const runDueSubscriptions = async () => {
  const due = await Subscription.find({
    status: SUBSCRIPTION_STATUS.ACTIVE,
    nextRunAt: { $lte: new Date() },
  });
  const settings = await getSettings();

  for (const subscription of due) {
    // eslint-disable-next-line no-await-in-loop
    const result = await createSingleItemOrder(subscription).catch((err) => ({ skipped: true, reason: err.message }));

    if (result.skipped) {
      subscription.consecutiveSkips += 1;
      // eslint-disable-next-line no-await-in-loop
      await notify(subscription.buyer, {
        type: 'subscription_skipped',
        title: 'Subscription order skipped',
        body: result.reason,
        link: '/subscriptions',
      });
      if (subscription.consecutiveSkips >= settings.maxSubscriptionSkips) {
        subscription.status = SUBSCRIPTION_STATUS.PAUSED;
        // eslint-disable-next-line no-await-in-loop
        await notify(subscription.buyer, {
          type: 'subscription_paused',
          title: 'Subscription paused',
          body: `We paused your subscription after ${settings.maxSubscriptionSkips} missed cycles in a row — you can resume it any time.`,
          link: '/subscriptions',
        });
      }
    } else {
      subscription.consecutiveSkips = 0;
      subscription.lastOrder = result.order._id;
      subscription.lastRunAt = new Date();
    }

    // Advance to the next scheduled slot — and if the subscription fell behind
    // by more than one cycle (e.g. the server was down for a few days), keep
    // advancing until we're back in the future. Otherwise this would place
    // one order now and then immediately be "due" again on the very next
    // cron tick, repeatedly, until it caught up — charging the buyer several
    // times in rapid succession instead of once per real cycle.
    let next = computeNextRunAt(subscription.frequency, subscription.nextRunAt);
    while (next <= new Date()) {
      next = computeNextRunAt(subscription.frequency, next);
    }
    subscription.nextRunAt = next;
    // eslint-disable-next-line no-await-in-loop
    await subscription.save();
  }
};

const startSubscriptionScheduler = () => {
  // Runs every hour — subscriptions are day/week/month cadence, so this is frequent enough.
  cron.schedule('0 * * * *', () => {
    runDueSubscriptions().catch((err) => console.error('[fundo] subscription scheduler error:', err.message));
  });
};

module.exports = { startSubscriptionScheduler, runDueSubscriptions, computeNextRunAt };
