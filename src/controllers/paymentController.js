const asyncHandler = require('express-async-handler');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { handlePaymentCallback } = require('../utils/walletService');
const { getProvider } = require('../utils/paymentProviders');
const { PAYMENT_STATUS, PAYMENT_METHOD, PAYMENT_PROVIDER } = require('../config/constants');

// @desc  Get a payment (buyer polls this while waiting for confirmation)
// @route GET /api/payments/:id
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate('orders');
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found.');
  }
  if (String(payment.buyer) !== String(req.user._id)) {
    res.status(403);
    throw new Error('You cannot view this payment.');
  }
  res.json({ success: true, data: payment });
});

// @desc  DEV/DEMO ONLY — instantly resolve a pending sandbox payment instead of
//        waiting for the simulated delay. Disabled outside development so it can
//        never be used to bypass real payment confirmation in production.
// @route POST /api/payments/:id/simulate
const simulate = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403);
    throw new Error('Not available in production.');
  }
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found.');
  }
  if (String(payment.buyer) !== String(req.user._id)) {
    res.status(403);
    throw new Error('You cannot act on this payment.');
  }
  if (payment.status !== PAYMENT_STATUS.PENDING) {
    res.status(400);
    throw new Error('This payment has already been resolved.');
  }

  const outcome = req.body.outcome === 'failed' ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.SUCCESSFUL;
  await handlePaymentCallback(payment.providerRef, outcome, outcome === PAYMENT_STATUS.FAILED ? 'Simulated failure.' : undefined);

  const updated = await Payment.findById(payment._id);
  res.json({ success: true, data: updated });
});

// @desc  Retry payment for orders whose previous payment failed (e.g. wrong PIN,
//        insufficient funds) — creates a fresh payment attempt for the same orders
//        rather than leaving them stuck unpaid with stock still reserved.
// @route POST /api/payments/:id/retry
const retry = asyncHandler(async (req, res) => {
  const previous = await Payment.findById(req.params.id);
  if (!previous) {
    res.status(404);
    throw new Error('Payment not found.');
  }
  if (String(previous.buyer) !== String(req.user._id)) {
    res.status(403);
    throw new Error('You cannot act on this payment.');
  }
  if (previous.status !== PAYMENT_STATUS.FAILED) {
    res.status(400);
    throw new Error('Only a failed payment can be retried.');
  }

  const { paymentMethod, paymentProvider, phoneNumber } = req.body;
  const method = paymentMethod || previous.method;
  if (!Object.values(PAYMENT_METHOD).includes(method)) {
    res.status(400);
    throw new Error('Invalid payment method.');
  }
  const provider = method === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : (paymentProvider || 'mtn');

  const { providerRef, message } = await getProvider(provider).initiate({ phoneNumber });

  const payment = await Payment.create({
    buyer: req.user._id,
    groupId: previous.groupId,
    orders: previous.orders,
    amount: previous.amount,
    method,
    provider,
    phoneNumber: method === PAYMENT_METHOD.MOBILE_MONEY ? phoneNumber : undefined,
    providerRef,
  });

  await Order.updateMany({ _id: { $in: previous.orders } }, { payment: payment._id });

  res.status(201).json({ success: true, data: { ...payment.toObject(), message } });
});

module.exports = { getPayment, simulate, retry };
