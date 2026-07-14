const { v4: uuidv4 } = require('uuid');
const { PAYMENT_STATUS } = require('../../config/constants');

/**
 * SANDBOX PROVIDER — for development/demo only.
 *
 * Simulates a mobile money "push" payment: the buyer gets a provider reference
 * immediately, and (like a real telco) the actual success/failure confirmation
 * arrives asynchronously — here via a timer instead of a webhook call.
 *
 * Test convention (mirrors real sandboxes like MTN MoMo's): a phone number
 * ending in "0000" simulates a failed payment (e.g. insufficient funds); any
 * other number succeeds after a short delay.
 *
 * To go live with a real provider (MTN MoMo, Airtel Money via Flutterwave/Paystack,
 * etc.), implement `initiate()` to call their API and have their webhook call
 * `walletService.handlePaymentCallback(providerRef, outcome)` — the rest of the
 * order/escrow/notification logic needs no changes.
 */
const CONFIRM_DELAY_MS = Number(process.env.MOCK_PAYMENT_DELAY_MS || 6000);

const initiate = async ({ phoneNumber, onResolve }) => {
  const providerRef = `MOCK-MM-${uuidv4().slice(0, 8).toUpperCase()}`;
  const willFail = (phoneNumber || '').replace(/\s/g, '').endsWith('0000');

  // Simulate the telco calling our webhook some seconds later.
  setTimeout(() => {
    // Default to the Order/Payment flow's resolver so existing callers (checkout,
    // subscriptions) don't need to pass anything — new flows (pre-orders) that
    // aren't Order-based can supply their own `onResolve` instead.
    const resolve = onResolve || require('../walletService').handlePaymentCallback;
    resolve(
      providerRef,
      willFail ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.SUCCESSFUL,
      willFail ? 'Insufficient funds on mobile money account (simulated).' : undefined
    ).catch((err) => console.error('[fundo] mock payment callback error:', err.message));
  }, CONFIRM_DELAY_MS);

  return { providerRef, message: 'A payment prompt has been sent to your phone (simulated).' };
};

module.exports = { initiate };
