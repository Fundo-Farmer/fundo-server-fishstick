const asyncHandler = require('express-async-handler');
const HarvestForecast = require('../models/HarvestForecast');
const PreOrder = require('../models/PreOrder');
const CoffeeGarden = require('../models/CoffeeGarden');
const Plantation = require('../models/Plantation');
const notify = require('../utils/notify');
const { getProvider } = require('../utils/paymentProviders');
const {
  handlePreOrderPaymentCallback, reverseAndRefundPreOrder, releaseEscrowForPreOrder,
} = require('../utils/preOrderService');
const {
  ROLES, HARVEST_FORECAST_STATUS, PREORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, PAYMENT_PROVIDER,
} = require('../config/constants');

const SUBJECT_MODELS = { CoffeeGarden, Plantation };

// ---------- Harvest forecasts ----------

// @desc  Farm staff: declare an upcoming harvest that buyers can pre-order against
// @route POST /api/preorders/forecasts
const createForecast = asyncHandler(async (req, res) => {
  if (![ROLES.FARM_ADMIN, ROLES.WORKER, ROLES.SUPER_ADMIN].includes(req.user.role) || !req.user.farm) {
    res.status(403);
    throw new Error('Only farm staff can create a harvest forecast.');
  }
  const { subjectType, subject, title, description, expectedDate, expectedQuantity, unit, pricePerUnit } = req.body;
  const Model = SUBJECT_MODELS[subjectType];
  if (!Model) {
    res.status(400);
    throw new Error('Invalid source type.');
  }
  const record = await Model.findById(subject);
  if (!record || String(record.farm) !== String(req.user.farm)) {
    res.status(400);
    throw new Error('That garden/plantation was not found on your farm.');
  }
  if (!title || !expectedDate || !expectedQuantity || !pricePerUnit) {
    res.status(400);
    throw new Error('Title, expected date, expected quantity and price are all required.');
  }

  const forecast = await HarvestForecast.create({
    farm: req.user.farm,
    createdBy: req.user._id,
    subjectType,
    subject,
    title,
    description,
    expectedDate,
    expectedQuantity,
    unit: unit || 'kg',
    pricePerUnit,
  });
  res.status(201).json({ success: true, data: forecast });
});

// @desc  Public: browse open harvest forecasts
// @route GET /api/preorders/forecasts
const browseForecasts = asyncHandler(async (req, res) => {
  const filter = { status: HARVEST_FORECAST_STATUS.OPEN };
  if (req.query.farm) filter.farm = req.query.farm;
  const forecasts = await HarvestForecast.find(filter)
    .populate('farm', 'name verification.status config.logo')
    .sort({ expectedDate: 1 });
  res.json({ success: true, data: forecasts });
});

// @desc  Farm staff: my farm's forecasts (any status)
// @route GET /api/preorders/forecasts/mine
const myForecasts = asyncHandler(async (req, res) => {
  if (!req.user.farm) return res.json({ success: true, data: [] });
  const forecasts = await HarvestForecast.find({ farm: req.user.farm }).sort({ createdAt: -1 });
  res.json({ success: true, data: forecasts });
});

// @desc  Get a single forecast (public)
// @route GET /api/preorders/forecasts/:id
const getForecast = asyncHandler(async (req, res) => {
  const forecast = await HarvestForecast.findById(req.params.id).populate('farm', 'name verification.status config.logo location');
  if (!forecast) {
    res.status(404);
    throw new Error('Forecast not found.');
  }
  res.json({ success: true, data: forecast });
});

const requireOwnForecast = async (id, farmId) => {
  const forecast = await HarvestForecast.findById(id);
  if (!forecast || String(forecast.farm) !== String(farmId)) return null;
  return forecast;
};

// @desc  Farm staff: update a forecast (before it's fulfilled)
// @route PUT /api/preorders/forecasts/:id
const updateForecast = asyncHandler(async (req, res) => {
  const forecast = await requireOwnForecast(req.params.id, req.user.farm);
  if (!forecast) {
    res.status(404);
    throw new Error('Forecast not found.');
  }
  if (forecast.status !== HARVEST_FORECAST_STATUS.OPEN) {
    res.status(400);
    throw new Error('This forecast can no longer be edited.');
  }
  const { title, description, expectedDate, expectedQuantity, pricePerUnit } = req.body;
  if (expectedQuantity && expectedQuantity < forecast.quantityReserved) {
    res.status(400);
    throw new Error(`Can't reduce below ${forecast.quantityReserved} ${forecast.unit} — that's already reserved by pre-orders.`);
  }
  if (title) forecast.title = title;
  if (description !== undefined) forecast.description = description;
  if (expectedDate) forecast.expectedDate = expectedDate;
  if (expectedQuantity) forecast.expectedQuantity = expectedQuantity;
  if (pricePerUnit) forecast.pricePerUnit = pricePerUnit;
  await forecast.save();
  res.json({ success: true, data: forecast });
});

// @desc  Upload photos for a forecast
// @route POST /api/preorders/forecasts/:id/photos
const uploadForecastPhotos = asyncHandler(async (req, res) => {
  const forecast = await requireOwnForecast(req.params.id, req.user.farm);
  if (!forecast) {
    res.status(404);
    throw new Error('Forecast not found.');
  }
  const files = req.files || [];
  forecast.images.push(...files.map((f) => `/uploads/${f.filename}`));
  await forecast.save();
  res.json({ success: true, data: forecast });
});

// @desc  Farm staff: cancel a forecast — refunds every active pre-order against it
// @route PUT /api/preorders/forecasts/:id/cancel
const cancelForecast = asyncHandler(async (req, res) => {
  const forecast = await requireOwnForecast(req.params.id, req.user.farm);
  if (!forecast) {
    res.status(404);
    throw new Error('Forecast not found.');
  }
  if ([HARVEST_FORECAST_STATUS.COMPLETED, HARVEST_FORECAST_STATUS.CANCELLED].includes(forecast.status)) {
    res.status(400);
    throw new Error('This forecast is already closed.');
  }

  const preOrders = await PreOrder.find({
    forecast: forecast._id,
    status: { $in: [PREORDER_STATUS.AWAITING_PAYMENT, PREORDER_STATUS.CONFIRMED] },
  });
  for (const preOrder of preOrders) {
    // eslint-disable-next-line no-await-in-loop
    await reverseAndRefundPreOrder(preOrder);
    preOrder.status = PREORDER_STATUS.CANCELLED;
    // eslint-disable-next-line no-await-in-loop
    await preOrder.save();
  }

  forecast.status = HARVEST_FORECAST_STATUS.CANCELLED;
  await forecast.save();
  res.json({ success: true, data: forecast });
});

// @desc  Farm staff: mark the harvest as fulfilled — releases escrow for every
//        confirmed (paid) pre-order against it. Actual delivery/pickup is
//        arranged directly with each buyer (e.g. via chat) — see README.
// @route PUT /api/preorders/forecasts/:id/fulfill
const fulfillForecast = asyncHandler(async (req, res) => {
  const forecast = await requireOwnForecast(req.params.id, req.user.farm);
  if (!forecast) {
    res.status(404);
    throw new Error('Forecast not found.');
  }
  if (forecast.status !== HARVEST_FORECAST_STATUS.OPEN) {
    res.status(400);
    throw new Error('Only an open forecast can be fulfilled.');
  }

  const preOrders = await PreOrder.find({ forecast: forecast._id, status: PREORDER_STATUS.CONFIRMED });
  for (const preOrder of preOrders) {
    // eslint-disable-next-line no-await-in-loop
    await releaseEscrowForPreOrder(preOrder);
    // eslint-disable-next-line no-await-in-loop
    await notify(preOrder.buyer, {
      type: 'preorder_fulfilled',
      title: 'Your harvest is ready',
      body: `"${forecast.title}" has been harvested — reach out to the seller to arrange ${preOrder.fulfillmentType}.`,
      link: '/preorders',
      sms: true,
    });
  }

  forecast.status = HARVEST_FORECAST_STATUS.COMPLETED;
  await forecast.save();
  res.json({ success: true, data: forecast });
});

// ---------- Pre-orders ----------

// @desc  Pre-order against an open forecast, and start payment
// @route POST /api/preorders
const createPreOrder = asyncHandler(async (req, res) => {
  const {
    forecast: forecastId, quantity, fulfillmentType, deliveryAddress, deliveryCoordinates,
    pickupNote, buyerContact, paymentMethod, paymentProvider, phoneNumber,
  } = req.body;

  const forecast = await HarvestForecast.findById(forecastId);
  if (!forecast || forecast.status !== HARVEST_FORECAST_STATUS.OPEN) {
    res.status(400);
    throw new Error('This forecast is not open for pre-orders.');
  }
  if (String(forecast.createdBy) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot pre-order your own harvest.');
  }
  if (!quantity || quantity < 1) {
    res.status(400);
    throw new Error('Quantity must be at least 1.');
  }
  const remaining = forecast.expectedQuantity - forecast.quantityReserved;
  if (quantity > remaining) {
    res.status(400);
    throw new Error(`Only ${remaining} ${forecast.unit} left available to pre-order.`);
  }
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    res.status(400);
    throw new Error('Please choose a payment method.');
  }
  if (paymentMethod === PAYMENT_METHOD.MOBILE_MONEY && (!['mtn', 'airtel'].includes(paymentProvider) || !phoneNumber)) {
    res.status(400);
    throw new Error('Please choose MTN or Airtel and provide a phone number for mobile money.');
  }

  // Reserve the quantity immediately so it can't be oversold while payment is pending.
  forecast.quantityReserved += quantity;
  await forecast.save();

  const preOrder = await PreOrder.create({
    buyer: req.user._id,
    seller: forecast.createdBy,
    forecast: forecast._id,
    quantity,
    unit: forecast.unit,
    pricePerUnit: forecast.pricePerUnit,
    fulfillmentType,
    deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress : undefined,
    deliveryCoordinates: fulfillmentType === 'delivery' ? deliveryCoordinates : undefined,
    pickupNote: fulfillmentType === 'pickup' ? pickupNote : undefined,
    buyerContact: buyerContact || req.user.phone,
    paymentMethod,
    paymentProvider,
    phoneNumber,
  });

  const provider = paymentMethod === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : paymentProvider;
  const { providerRef, message } = await getProvider(provider).initiate({ phoneNumber, onResolve: handlePreOrderPaymentCallback });
  preOrder.providerRef = providerRef;
  preOrder.paymentProvider = provider;
  await preOrder.save();

  await notify(forecast.createdBy, {
    type: 'preorder_placed',
    title: 'New pre-order',
    body: `A pre-order for ${quantity} ${forecast.unit} of "${forecast.title}" has been placed — awaiting payment.`,
    link: '/preorders/selling',
  });

  res.status(201).json({ success: true, data: preOrder, message });
});

// @desc  My pre-orders (as a buyer)
// @route GET /api/preorders/mine
const listMine = asyncHandler(async (req, res) => {
  const preOrders = await PreOrder.find({ buyer: req.user._id })
    .populate('forecast', 'title expectedDate images farm')
    .populate('seller', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: preOrders });
});

// @desc  Pre-orders against my forecasts (as a seller)
// @route GET /api/preorders/selling
const listSelling = asyncHandler(async (req, res) => {
  const preOrders = await PreOrder.find({ seller: req.user._id })
    .populate('forecast', 'title expectedDate status')
    .populate('buyer', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: preOrders });
});

// @desc  Cancel my own pre-order (before the harvest is fulfilled)
// @route PUT /api/preorders/:id/cancel
const cancelPreOrder = asyncHandler(async (req, res) => {
  const preOrder = await PreOrder.findById(req.params.id);
  if (!preOrder || String(preOrder.buyer) !== String(req.user._id)) {
    res.status(404);
    throw new Error('Pre-order not found.');
  }
  if ([PREORDER_STATUS.FULFILLED, PREORDER_STATUS.CANCELLED].includes(preOrder.status)) {
    res.status(400);
    throw new Error('This pre-order can no longer be cancelled.');
  }

  const wasPaid = preOrder.paymentStatus === PAYMENT_STATUS.SUCCESSFUL;
  if (wasPaid) {
    await reverseAndRefundPreOrder(preOrder); // also releases the reserved quantity
  } else {
    await HarvestForecast.findByIdAndUpdate(preOrder.forecast, { $inc: { quantityReserved: -preOrder.quantity } });
  }
  preOrder.status = PREORDER_STATUS.CANCELLED;
  await preOrder.save();

  res.json({ success: true, data: preOrder });
});

// @desc  DEV/DEMO ONLY — instantly resolve a pending pre-order payment
// @route POST /api/preorders/:id/simulate
const simulatePayment = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403);
    throw new Error('Not available in production.');
  }
  const preOrder = await PreOrder.findById(req.params.id);
  if (!preOrder || String(preOrder.buyer) !== String(req.user._id)) {
    res.status(404);
    throw new Error('Pre-order not found.');
  }
  if (preOrder.paymentStatus !== PAYMENT_STATUS.PENDING) {
    res.status(400);
    throw new Error('This payment has already been resolved.');
  }
  const outcome = req.body.outcome === 'failed' ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.SUCCESSFUL;
  await handlePreOrderPaymentCallback(preOrder.providerRef, outcome, outcome === PAYMENT_STATUS.FAILED ? 'Simulated failure.' : undefined);
  const updated = await PreOrder.findById(preOrder._id);
  res.json({ success: true, data: updated });
});

// @desc  Retry payment after a failure, for the same pre-order
// @route POST /api/preorders/:id/retry
const retryPayment = asyncHandler(async (req, res) => {
  const preOrder = await PreOrder.findById(req.params.id);
  if (!preOrder || String(preOrder.buyer) !== String(req.user._id)) {
    res.status(404);
    throw new Error('Pre-order not found.');
  }
  if (preOrder.paymentStatus !== PAYMENT_STATUS.FAILED) {
    res.status(400);
    throw new Error('Only a failed payment can be retried.');
  }
  const { paymentMethod, paymentProvider, phoneNumber } = req.body;
  const method = paymentMethod || preOrder.paymentMethod;
  const provider = method === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : (paymentProvider || preOrder.paymentProvider);

  const { providerRef, message } = await getProvider(provider).initiate({ phoneNumber: phoneNumber || preOrder.phoneNumber, onResolve: handlePreOrderPaymentCallback });
  preOrder.paymentMethod = method;
  preOrder.paymentProvider = provider;
  if (phoneNumber) preOrder.phoneNumber = phoneNumber;
  preOrder.providerRef = providerRef;
  preOrder.paymentStatus = PAYMENT_STATUS.PENDING;
  preOrder.failureReason = undefined;
  await preOrder.save();

  res.json({ success: true, data: preOrder, message });
});

module.exports = {
  createForecast, browseForecasts, myForecasts, getForecast, updateForecast, uploadForecastPhotos,
  cancelForecast, fulfillForecast,
  createPreOrder, listMine, listSelling, cancelPreOrder, simulatePayment, retryPayment,
};
