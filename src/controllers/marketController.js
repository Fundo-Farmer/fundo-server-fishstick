const asyncHandler = require('express-async-handler');
const MarketItem = require('../models/MarketItem');
const Farm = require('../models/Farm');
const Livestock = require('../models/Livestock');
const Pet = require('../models/Pet');
const CoffeeGarden = require('../models/CoffeeGarden');
const Plantation = require('../models/Plantation');
const HarvestRecord = require('../models/HarvestRecord');
const ProduceRecord = require('../models/ProduceRecord');
const { notifyWishlistersBackInStock, notifyWishlistersPriceDrop } = require('../utils/wishlistAlerts');
const { getProvider } = require('../utils/paymentProviders');
const { handleFeatureListingPayment } = require('../utils/featuredListingService');
const { getSettings } = require('../utils/settingsService');
const {
  LISTING_STATUS, ROLES, CERTIFICATION_TAGS, PAYMENT_METHOD, PAYMENT_PROVIDER, PAYMENT_STATUS,
} = require('../config/constants');

// Livestock/Pet/CoffeeGarden/Plantation trace to the animal or plot itself, and (for
// Livestock/Pet) drive inventory sync — see utils/inventorySync.js. HarvestRecord and
// ProduceRecord trace to one specific batch (e.g. "harvested 12 Jul, graded AA") and
// are provenance-only: there's no "sold out" state on a harvest record to flip.
const SOURCE_MODELS = { Livestock, Pet, CoffeeGarden, Plantation, HarvestRecord, ProduceRecord };
const SELLER_FIELDS = 'name phone ratingAvg ratingCount';
const FARM_FIELDS = 'name config.logo verification.status certifications ratingAvg ratingCount';

// @desc  Public: browse marketplace listings
// @route GET /api/market
const browseListings = asyncHandler(async (req, res) => {
  const filter = { status: LISTING_STATUS.AVAILABLE };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) filter.$text = { $search: req.query.q };
  if (req.query.location) filter.location = { $regex: req.query.location, $options: 'i' };
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }
  if (req.query.verifiedOnly === 'true') {
    const verifiedFarmIds = await Farm.find({ 'verification.status': 'verified' }).select('_id');
    filter.farm = { $in: verifiedFarmIds.map((f) => f._id) };
  }

  const SORTS = {
    newest: { isFeatured: -1, createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };
  const sort = SORTS[req.query.sort] || SORTS.newest;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 24, 100);

  const [items, total] = await Promise.all([
    MarketItem.find(filter)
      .populate('seller', SELLER_FIELDS)
      .populate('farm', FARM_FIELDS)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    MarketItem.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, page, total, pages: Math.ceil(total / limit) });
});

// @desc  Get single listing
// @route GET /api/market/:id
const getListing = asyncHandler(async (req, res) => {
  const item = await MarketItem.findById(req.params.id).populate('seller', SELLER_FIELDS).populate('farm', FARM_FIELDS);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  res.json({ success: true, data: item });
});

// Safe, buyer-facing subset of fields per source type — never expose internal
// farm data (costs, medical history, other financial records) through this.
const PROVENANCE_FIELDS = {
  Livestock: 'name species breed gender dateOfBirth photos status',
  Pet: 'name species breed gender dateOfBirth photos status',
  CoffeeGarden: 'name variety sizeAcres location plantedDate photos',
  Plantation: 'name cropType variety sizeAcres location plantedDate photos',
  HarvestRecord: 'date quantity unit quality subjectType subject',
  ProduceRecord: 'date produceType quantity unit',
};

// @desc  Public: where a listing actually came from (farm record + farm trust signals)
// @route GET /api/market/:id/provenance
const getProvenance = asyncHandler(async (req, res) => {
  const item = await MarketItem.findById(req.params.id).populate('farm', FARM_FIELDS);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (!item.sourceType || !item.sourceId) {
    return res.json({ success: true, data: null });
  }
  const Model = SOURCE_MODELS[item.sourceType];
  if (!Model) return res.json({ success: true, data: null });

  let query = Model.findById(item.sourceId).select(PROVENANCE_FIELDS[item.sourceType]);
  if (item.sourceType === 'HarvestRecord') query = query.populate('subject', 'name');
  const record = await query;

  res.json({ success: true, data: { sourceType: item.sourceType, record, farm: item.farm } });
});

// @desc  Create a listing (farm staff only — not open to plain customer accounts)
// @route POST /api/market
const createListing = asyncHandler(async (req, res) => {
  if (![ROLES.FARM_ADMIN, ROLES.WORKER, ROLES.SUPER_ADMIN].includes(req.user.role)) {
    res.status(403);
    throw new Error('Only farm accounts can list items for sale.');
  }
  const payload = { ...req.body, seller: req.user._id };
  if (req.user.farm) payload.farm = req.user.farm;
  if (Array.isArray(payload.qualityTags)) {
    payload.qualityTags = payload.qualityTags.filter((t) => CERTIFICATION_TAGS.includes(t));
  } else {
    delete payload.qualityTags;
  }

  // Only farm staff may link a listing to one of their own farm records, and only
  // to a record that actually belongs to their farm (prevents cross-farm linking).
  if (payload.sourceType && payload.sourceId) {
    if (!req.user.farm) {
      res.status(403);
      throw new Error('Only farm staff can link a listing to a farm record.');
    }
    const Model = SOURCE_MODELS[payload.sourceType];
    if (!Model) {
      res.status(400);
      throw new Error('Invalid source type.');
    }
    const record = await Model.findById(payload.sourceId);
    if (!record || String(record.farm) !== String(req.user.farm)) {
      res.status(400);
      throw new Error('That record was not found on your farm.');
    }
  } else {
    delete payload.sourceType;
    delete payload.sourceId;
  }

  const item = await MarketItem.create(payload);
  res.status(201).json({ success: true, data: item });
});

// @desc  List the logged-in farm user's own records available to link/sell
// @route GET /api/market/sources?type=Livestock
const listSellableSources = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const Model = SOURCE_MODELS[type];
  if (!Model) {
    res.status(400);
    throw new Error('Invalid or missing source type.');
  }
  if (!req.user.farm) {
    return res.json({ success: true, data: [] });
  }

  if (type === 'Livestock' || type === 'Pet') {
    const records = await Model.find({ farm: req.user.farm, status: 'active' }).select('name species gender photos');
    return res.json({ success: true, data: records.map((r) => ({ _id: r._id, label: r.name })) });
  }
  if (type === 'CoffeeGarden' || type === 'Plantation') {
    const records = await Model.find({ farm: req.user.farm, status: 'active' }).select('name');
    return res.json({ success: true, data: records.map((r) => ({ _id: r._id, label: r.name })) });
  }
  // HarvestRecord / ProduceRecord — offer the most recent batches as "label: date + qty"
  const records = await Model.find({ farm: req.user.farm }).sort({ date: -1 }).limit(20).populate('subject', 'name');
  return res.json({
    success: true,
    data: records.map((r) => ({
      _id: r._id,
      label: `${new Date(r.date).toLocaleDateString()} — ${r.quantity}${r.unit ? ` ${r.unit}` : ''}${r.subject?.name ? ` (${r.subject.name})` : ''}`,
    })),
  });
});

// @desc  Attach photos to a listing
// @route POST /api/market/:id/photos
const uploadPhotos = asyncHandler(async (req, res) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (String(item.seller) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only edit your own listing.');
  }
  const files = req.files || [];
  item.images.push(...files.map((f) => `/uploads/${f.filename}`));
  await item.save();
  res.json({ success: true, data: item });
});

// @desc  Update own listing
// @route PUT /api/market/:id
const updateListing = asyncHandler(async (req, res) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (String(item.seller) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only edit your own listing.');
  }

  const oldPrice = item.price;
  const wasSoldOut = item.status === LISTING_STATUS.SOLD;

  Object.assign(item, req.body);
  // Manually topping up quantity on a sold-out listing should reopen it.
  if (wasSoldOut && item.quantity > 0 && req.body.status === undefined) {
    item.status = LISTING_STATUS.AVAILABLE;
  }
  await item.save();

  if (wasSoldOut && item.status === LISTING_STATUS.AVAILABLE) {
    await notifyWishlistersBackInStock(item);
  }
  if (req.body.price !== undefined && item.price < oldPrice) {
    await notifyWishlistersPriceDrop(item, oldPrice);
  }

  res.json({ success: true, data: item });
});

// @desc  Remove own listing
// @route DELETE /api/market/:id
const deleteListing = asyncHandler(async (req, res) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (String(item.seller) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only remove your own listing.');
  }
  await item.deleteOne();
  res.json({ success: true, message: 'Listing removed.' });
});

// @desc  My listings
// @route GET /api/market/mine
const myListings = asyncHandler(async (req, res) => {
  const items = await MarketItem.find({ seller: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: items });
});

// @desc  Pay to feature a listing at the top of the shop for a set number of days
// @route POST /api/market/:id/feature
const featureListing = asyncHandler(async (req, res) => {
  const item = await MarketItem.findById(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (String(item.seller) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only feature your own listing.');
  }
  if (item.isFeatured && item.featuredUntil > new Date()) {
    res.status(400);
    throw new Error(`This listing is already featured until ${item.featuredUntil.toLocaleDateString()}.`);
  }
  if (item.featurePaymentRef) {
    res.status(400);
    throw new Error('A featuring payment is already in progress for this listing.');
  }

  const { paymentMethod, paymentProvider, phoneNumber } = req.body;
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    res.status(400);
    throw new Error('Please choose a payment method.');
  }
  if (paymentMethod === PAYMENT_METHOD.MOBILE_MONEY && (!['mtn', 'airtel'].includes(paymentProvider) || !phoneNumber)) {
    res.status(400);
    throw new Error('Please choose MTN or Airtel and provide a phone number.');
  }

  const provider = paymentMethod === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : paymentProvider;
  const { providerRef, message } = await getProvider(provider).initiate({ phoneNumber, onResolve: handleFeatureListingPayment });
  item.featurePaymentRef = providerRef;
  await item.save();

  const settings = await getSettings();
  res.status(201).json({
    success: true,
    data: { providerRef, fee: settings.featuredListing.fee, days: settings.featuredListing.days, message },
  });
});

// @desc  DEV/DEMO ONLY — instantly resolve a pending featuring payment
// @route POST /api/market/:id/feature/simulate
const simulateFeaturePayment = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403);
    throw new Error('Not available in production.');
  }
  const item = await MarketItem.findById(req.params.id);
  if (!item || !item.featurePaymentRef) {
    res.status(400);
    throw new Error('No featuring payment is pending for this listing.');
  }
  const outcome = req.body.outcome === 'failed' ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.SUCCESSFUL;
  await handleFeatureListingPayment(item.featurePaymentRef, outcome);
  const updated = await MarketItem.findById(item._id);
  res.json({ success: true, data: updated });
});

module.exports = {
  browseListings,
  getListing,
  getProvenance,
  createListing,
  listSellableSources,
  uploadPhotos,
  updateListing,
  deleteListing,
  myListings,
  featureListing,
  simulateFeaturePayment,
};
