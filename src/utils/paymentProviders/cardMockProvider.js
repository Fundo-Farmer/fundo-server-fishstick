const { v4: uuidv4 } = require('uuid');
const { PAYMENT_STATUS } = require('../../config/constants');

/**
 * SANDBOX PROVIDER — for development/demo only. See mockMoneyProvider.js for the
 * pattern to follow when wiring in a real card processor (Flutterwave, Paystack,
 * Stripe, etc.): implement `initiate()` against their API, and have their
 * webhook call `walletService.handlePaymentCallback(providerRef, outcome)`.
 */
const CONFIRM_DELAY_MS = Number(process.env.MOCK_PAYMENT_DELAY_MS || 3000);

const initiate = async ({ onResolve } = {}) => {
  const providerRef = `MOCK-CARD-${uuidv4().slice(0, 8).toUpperCase()}`;

  setTimeout(() => {
    // Same default-resolver pattern as mockMoneyProvider.js: Order/Payment
    // flows (checkout, subscriptions) don't need to pass anything; flows that
    // aren't Order-based (pre-orders) supply their own `onResolve`.
    const resolve = onResolve || require('../walletService').handlePaymentCallback;
    resolve(providerRef, PAYMENT_STATUS.SUCCESSFUL).catch((err) =>
      console.error('[fundo] mock card callback error:', err.message)
    );
  }, CONFIRM_DELAY_MS);

  return { providerRef, message: 'Processing card payment (simulated).' };
};

module.exports = { initiate };
