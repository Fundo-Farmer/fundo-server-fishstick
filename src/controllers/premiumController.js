const asyncHandler = require('express-async-handler');
const FarmPremiumSubscription = require('../models/FarmPremiumSubscription');
const { getProvider } = require('../utils/paymentProviders');
const { handlePremiumPaymentCallback } = require('../utils/premiumService');
const {
  ROLES, PAYMENT_METHOD, PAYMENT_PROVIDER, PAYMENT_STATUS, FARM_PREMIUM_STATUS, PREMIUM_PLAN,
} = require('../config/constants');

const requireFarmManager = (req) => {
  if (![ROLES.FARM_ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role) || !req.user.farm) {
    const err = new Error('Only a farm admin can manage the Premium plan.');
    err.statusCode = 403;
    throw err;
  }
};

// @desc  My farm's Premium status
// @route GET /api/premium/status
const getStatus = asyncHandler(async (req, res) => {
  if (!req.user.farm) return res.json({ success: true, data: null });
  const sub = await FarmPremiumSubscription.findOne({ farm: req.user.farm });
  res.json({ success: true, data: sub });
});

// @desc  Subscribe (or resubscribe) to the Premium plan
// @route POST /api/premium/subscribe
const subscribe = asyncHandler(async (req, res) => {
  requireFarmManager(req);
  const { paymentMethod, paymentProvider, phoneNumber } = req.body;
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    res.status(400);
    throw new Error('Please choose a payment method.');
  }
  if (paymentMethod === PAYMENT_METHOD.MOBILE_MONEY && (!['mtn', 'airtel'].includes(paymentProvider) || !phoneNumber)) {
    res.status(400);
    throw new Error('Please choose MTN or Airtel and provide a phone number.');
  }

  let sub = await FarmPremiumSubscription.findOne({ farm: req.user.farm });
  if (sub && sub.status === FARM_PREMIUM_STATUS.ACTIVE) {
    res.status(400);
    throw new Error('Your farm is already on the Premium plan.');
  }

  const provider = paymentMethod === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : paymentProvider;
  const { providerRef, message } = await getProvider(provider).initiate({ phoneNumber, onResolve: handlePremiumPaymentCallback });

  if (sub) {
    sub.paymentMethod = paymentMethod;
    sub.paymentProvider = provider;
    sub.phoneNumber = phoneNumber;
    sub.providerRef = providerRef;
    sub.amount = PREMIUM_PLAN.MONTHLY_FEE;
    sub.nextBillingAt = new Date();
    await sub.save();
  } else {
    sub = await FarmPremiumSubscription.create({
      farm: req.user.farm,
      subscribedBy: req.user._id,
      amount: PREMIUM_PLAN.MONTHLY_FEE,
      paymentMethod,
      paymentProvider: provider,
      phoneNumber,
      providerRef,
      nextBillingAt: new Date(),
    });
  }

  res.status(201).json({ success: true, data: sub, message });
});

// @desc  Cancel the Premium plan (takes effect immediately — no partial refund
//        for the remainder of the paid month, same as most subscription products)
// @route PUT /api/premium/cancel
const cancel = asyncHandler(async (req, res) => {
  requireFarmManager(req);
  const sub = await FarmPremiumSubscription.findOne({ farm: req.user.farm });
  if (!sub) {
    res.status(404);
    throw new Error('No Premium subscription found.');
  }
  sub.status = FARM_PREMIUM_STATUS.CANCELLED;
  sub.cancelledAt = new Date();
  await sub.save();
  res.json({ success: true, data: sub });
});

// @desc  DEV/DEMO ONLY — instantly resolve a pending Premium billing payment
// @route POST /api/premium/simulate
const simulatePayment = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403);
    throw new Error('Not available in production.');
  }
  requireFarmManager(req);
  const sub = await FarmPremiumSubscription.findOne({ farm: req.user.farm });
  if (!sub || !sub.providerRef) {
    res.status(400);
    throw new Error('No payment is pending.');
  }
  const outcome = req.body.outcome === 'failed' ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.SUCCESSFUL;
  await handlePremiumPaymentCallback(sub.providerRef, outcome);
  const updated = await FarmPremiumSubscription.findById(sub._id);
  res.json({ success: true, data: updated });
});

module.exports = { getStatus, subscribe, cancel, simulatePayment };
