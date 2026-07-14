const asyncHandler = require('express-async-handler');
const Subscription = require('../models/Subscription');
const MarketItem = require('../models/MarketItem');
const { createSingleItemOrder } = require('../utils/orderCreation');
const { computeNextRunAt } = require('../utils/subscriptionScheduler');
const {
  FULFILLMENT_TYPE, PAYMENT_METHOD, SUBSCRIPTION_FREQUENCY, SUBSCRIPTION_STATUS,
} = require('../config/constants');

// @desc  Subscribe to a listing — places the first order immediately, then recurs
// @route POST /api/subscriptions
const createSubscription = asyncHandler(async (req, res) => {
  const {
    marketItem: marketItemId, quantity, frequency, fulfillmentType,
    deliveryAddress, deliveryCoordinates, pickupNote, buyerContact,
    paymentMethod, paymentProvider, phoneNumber,
  } = req.body;

  if (!Object.values(SUBSCRIPTION_FREQUENCY).includes(frequency)) {
    res.status(400);
    throw new Error('Please choose how often this should repeat.');
  }
  if (!Object.values(FULFILLMENT_TYPE).includes(fulfillmentType)) {
    res.status(400);
    throw new Error('Please choose delivery or pickup.');
  }
  if (fulfillmentType === FULFILLMENT_TYPE.DELIVERY && !deliveryAddress) {
    res.status(400);
    throw new Error('A delivery address is required.');
  }
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    res.status(400);
    throw new Error('Please choose a payment method.');
  }
  if (paymentMethod === PAYMENT_METHOD.MOBILE_MONEY && (!['mtn', 'airtel'].includes(paymentProvider) || !phoneNumber)) {
    res.status(400);
    throw new Error('Please choose MTN or Airtel and provide a phone number for mobile money.');
  }

  const item = await MarketItem.findById(marketItemId);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (String(item.seller) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot subscribe to your own listing.');
  }
  if (!quantity || quantity < 1) {
    res.status(400);
    throw new Error('Quantity must be at least 1.');
  }
  if (item.status !== 'available') {
    res.status(400);
    throw new Error('This listing is not currently available.');
  }
  if (quantity > item.quantity) {
    res.status(400);
    throw new Error(`Only ${item.quantity} ${item.unit} available — reduce the quantity to subscribe.`);
  }

  const subscription = await Subscription.create({
    buyer: req.user._id,
    seller: item.seller,
    marketItem: item._id,
    quantity,
    frequency,
    fulfillmentType,
    deliveryAddress: fulfillmentType === FULFILLMENT_TYPE.DELIVERY ? deliveryAddress : undefined,
    deliveryCoordinates: fulfillmentType === FULFILLMENT_TYPE.DELIVERY ? deliveryCoordinates : undefined,
    pickupNote: fulfillmentType === FULFILLMENT_TYPE.PICKUP ? pickupNote : undefined,
    buyerContact: buyerContact || req.user.phone,
    paymentMethod,
    paymentProvider,
    phoneNumber,
    nextRunAt: new Date(), // first cycle runs immediately, below
  });

  const firstRun = await createSingleItemOrder(subscription);
  if (firstRun.skipped) {
    subscription.consecutiveSkips = 1;
  } else {
    subscription.lastOrder = firstRun.order._id;
    subscription.lastRunAt = new Date();
  }
  subscription.nextRunAt = computeNextRunAt(frequency, new Date());
  await subscription.save();

  res.status(201).json({ success: true, data: subscription, firstOrder: firstRun.skipped ? null : firstRun.order });
});

// @desc  My subscriptions (as a buyer)
// @route GET /api/subscriptions/mine
const listMine = asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.find({ buyer: req.user._id })
    .populate({ path: 'marketItem', select: 'title images price unit status' })
    .populate('seller', 'name')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: subscriptions });
});

// @desc  Subscriptions against my listings (as a seller)
// @route GET /api/subscriptions/selling
const listSelling = asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.find({ seller: req.user._id })
    .populate({ path: 'marketItem', select: 'title images price unit status' })
    .populate('buyer', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: subscriptions });
});

const findMySubscription = async (id, buyerId) => {
  const subscription = await Subscription.findById(id);
  if (!subscription || String(subscription.buyer) !== String(buyerId)) return null;
  return subscription;
};

// @desc  Pause a subscription
// @route PUT /api/subscriptions/:id/pause
const pause = asyncHandler(async (req, res) => {
  const subscription = await findMySubscription(req.params.id, req.user._id);
  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found.');
  }
  subscription.status = SUBSCRIPTION_STATUS.PAUSED;
  await subscription.save();
  res.json({ success: true, data: subscription });
});

// @desc  Resume a paused subscription
// @route PUT /api/subscriptions/:id/resume
const resume = asyncHandler(async (req, res) => {
  const subscription = await findMySubscription(req.params.id, req.user._id);
  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found.');
  }
  subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
  subscription.consecutiveSkips = 0;
  // Resuming shouldn't immediately fire an overdue cycle if it was paused a while — push to next cycle from now.
  subscription.nextRunAt = computeNextRunAt(subscription.frequency, new Date());
  await subscription.save();
  res.json({ success: true, data: subscription });
});

// @desc  Cancel a subscription for good
// @route PUT /api/subscriptions/:id/cancel
const cancelSubscription = asyncHandler(async (req, res) => {
  const subscription = await findMySubscription(req.params.id, req.user._id);
  if (!subscription) {
    res.status(404);
    throw new Error('Subscription not found.');
  }
  subscription.status = SUBSCRIPTION_STATUS.CANCELLED;
  await subscription.save();
  res.json({ success: true, data: subscription });
});

module.exports = { createSubscription, listMine, listSelling, pause, resume, cancelSubscription };
