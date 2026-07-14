const mockMoneyProvider = require('./mockMoneyProvider');
const cardMockProvider = require('./cardMockProvider');

/**
 * Every provider must export an `initiate({ payment, phoneNumber })` function
 * that returns `{ providerRef, message }`. The eventual success/failure is
 * reported back asynchronously by calling
 * `require('../walletService').handlePaymentCallback(providerRef, outcome)` —
 * from a timer here in sandbox mode, or from a webhook route in production.
 *
 * MTN and Airtel currently both resolve to the same mock mobile-money provider;
 * in production these would be two distinct integrations (MTN MoMo API vs
 * Airtel Money API, or a single aggregator like Flutterwave/Paystack that
 * abstracts both).
 */
const REGISTRY = {
  mtn: mockMoneyProvider,
  airtel: mockMoneyProvider,
  card_mock: cardMockProvider,
};

const getProvider = (name) => {
  const provider = REGISTRY[name];
  if (!provider) throw new Error(`Unknown payment provider: ${name}`);
  return provider;
};

module.exports = { getProvider };
