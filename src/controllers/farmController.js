const asyncHandler = require('express-async-handler');
const Farm = require('../models/Farm');
const MarketItem = require('../models/MarketItem');
const Auction = require('../models/Auction');
const FarmPremiumSubscription = require('../models/FarmPremiumSubscription');
const notify = require('../utils/notify');
const { refreshStatus } = require('./auctionController');
const { ROLES, LISTING_STATUS, AUCTION_STATUS } = require('../config/constants');

// @desc  Get my farm (farm_admin/worker) or list all farms (super_admin)
// @route GET /api/farms
const listFarms = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.SUPER_ADMIN) {
    const farms = await Farm.find().populate('owner', 'name email');
    return res.json({ success: true, data: farms });
  }
  if (!req.user.farm) return res.json({ success: true, data: [] });
  const farm = await Farm.findById(req.user.farm).populate('owner', 'name email');
  res.json({ success: true, data: farm ? [farm] : [] });
});

// @desc  Get single farm (public fields only when accessed anonymously via marketplace context)
// @route GET /api/farms/:id
const getFarm = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id).populate('owner', 'name email');
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.farm) !== String(farm._id)) {
    res.status(403);
    throw new Error('You cannot access another farm.');
  }
  res.json({ success: true, data: farm });
});

// @desc  Public: minimal farm info for trust display (name, verification, certifications)
// @route GET /api/farms/:id/public
const getPublicFarm = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id).select('name location config.logo verification.status certifications');
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  res.json({ success: true, data: farm });
});

// @desc  Public: a farm's storefront — profile plus its active listings and auctions
// @route GET /api/farms/:id/storefront
const getStorefront = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id).select(
    'name location description config.logo verification.status certifications ratingAvg ratingCount createdAt'
  );
  if (!farm || !farm.isActive) {
    res.status(404);
    throw new Error('Farm not found.');
  }

  const [listings, auctions, premium] = await Promise.all([
    MarketItem.find({ farm: farm._id, status: LISTING_STATUS.AVAILABLE }).sort({ createdAt: -1 }),
    Auction.find({ farm: farm._id, status: { $in: [AUCTION_STATUS.LIVE, AUCTION_STATUS.SCHEDULED] } }).sort({ endTime: 1 }),
    FarmPremiumSubscription.findOne({ farm: farm._id, status: 'active' }).select('status'),
  ]);
  auctions.forEach(refreshStatus);
  await Promise.all(auctions.map((a) => a.save()));

  res.json({ success: true, data: { farm, listings, auctions, isPremium: !!premium } });
});

// @desc  Update farm profile / theme / logo / name / certifications
// @route PUT /api/farms/:id
const updateFarm = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.farm) !== String(farm._id)) {
    res.status(403);
    throw new Error('You cannot modify another farm.');
  }
  const { name, location, description, config, modulesEnabled, certifications, coordinates } = req.body;
  if (name) farm.name = name;
  if (location !== undefined) farm.location = location;
  if (description !== undefined) farm.description = description;
  if (config) farm.config = { ...farm.config.toObject(), ...config };
  if (coordinates) farm.coordinates = coordinates;
  // Certifications are admin-curated (set during verification review), not
  // something a farm can just declare about itself — see reviewVerification.
  if (certifications !== undefined && req.user.role === ROLES.SUPER_ADMIN) {
    farm.certifications = certifications;
  }
  if (modulesEnabled && req.user.role === ROLES.SUPER_ADMIN) {
    farm.modulesEnabled = { ...farm.modulesEnabled.toObject(), ...modulesEnabled };
  }
  await farm.save();
  res.json({ success: true, data: farm });
});

// @desc  Super admin: deactivate/reactivate a farm
// @route PUT /api/farms/:id/status
const setFarmStatus = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  farm.isActive = req.body.isActive;
  await farm.save();
  res.json({ success: true, data: farm });
});

// @desc  Upload a farm logo
// @route POST /api/farms/:id/logo
const uploadLogo = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.farm) !== String(farm._id)) {
    res.status(403);
    throw new Error('You cannot modify another farm.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No logo file uploaded.');
  }
  farm.config.logo = `/uploads/${req.file.filename}`;
  await farm.save();
  res.json({ success: true, data: farm });
});

// @desc  Farm admin: submit (or resubmit) a request for the "Verified farm" badge
// @route POST /api/farms/:id/verification/request
const requestVerification = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.farm) !== String(farm._id)) {
    res.status(403);
    throw new Error('You cannot request verification for another farm.');
  }
  if (farm.verification.status === 'verified') {
    res.status(400);
    throw new Error('This farm is already verified.');
  }
  if (farm.verification.status === 'pending') {
    res.status(400);
    throw new Error('A verification request is already pending review.');
  }

  farm.verification.status = 'pending';
  farm.verification.requestNote = req.body.note || '';
  farm.verification.requestedAt = new Date();
  farm.verification.reviewedAt = undefined;
  farm.verification.reviewedBy = undefined;
  farm.verification.reviewNote = undefined;
  await farm.save();

  res.json({ success: true, data: farm });
});

// @desc  Farm admin: upload supporting documents/photos for a verification request
// @route POST /api/farms/:id/verification/documents
const uploadVerificationDocuments = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.farm) !== String(farm._id)) {
    res.status(403);
    throw new Error('You cannot modify another farm.');
  }
  const files = req.files || [];
  farm.verification.documents.push(...files.map((f) => `/uploads/${f.filename}`));
  await farm.save();
  res.json({ success: true, data: farm });
});

// @desc  Super admin: list farms with a pending verification request
// @route GET /api/farms/verification/pending
const listPendingVerifications = asyncHandler(async (req, res) => {
  const farms = await Farm.find({ 'verification.status': 'pending' }).populate('owner', 'name email phone');
  res.json({ success: true, data: farms });
});

// @desc  Super admin: approve or reject a farm's verification request
// @route PUT /api/farms/:id/verification/review
const reviewVerification = asyncHandler(async (req, res) => {
  const farm = await Farm.findById(req.params.id);
  if (!farm) {
    res.status(404);
    throw new Error('Farm not found.');
  }
  const approve = req.body.action === 'approve';
  farm.verification.status = approve ? 'verified' : 'rejected';
  farm.verification.reviewedAt = new Date();
  farm.verification.reviewedBy = req.user._id;
  farm.verification.reviewNote = req.body.note || '';
  if (approve && Array.isArray(req.body.certifications)) {
    farm.certifications = req.body.certifications;
  }
  await farm.save();

  await notify(farm.owner, {
    type: approve ? 'farm_verified' : 'farm_verification_rejected',
    title: approve ? 'Your farm is now verified' : 'Verification request declined',
    body: approve
      ? `${farm.name} now shows the Verified badge to buyers.`
      : `Your verification request for ${farm.name} was declined${req.body.note ? `: ${req.body.note}` : '.'}`,
    link: '/dashboard/settings',
  });

  res.json({ success: true, data: farm });
});

module.exports = {
  listFarms,
  getFarm,
  getPublicFarm,
  getStorefront,
  updateFarm,
  setFarmStatus,
  uploadLogo,
  requestVerification,
  uploadVerificationDocuments,
  listPendingVerifications,
  reviewVerification,
};
