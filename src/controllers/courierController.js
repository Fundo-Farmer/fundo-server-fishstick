const asyncHandler = require('express-async-handler');
const Courier = require('../models/Courier');
const notify = require('../utils/notify');
const { VEHICLE_TYPES, COURIER_VERIFICATION_STATUS } = require('../config/constants');

// @desc  Register the current user as a courier
// @route POST /api/couriers/register
const registerCourier = asyncHandler(async (req, res) => {
  const { vehicleType, vehiclePlate, serviceRadiusKm, baseLocation, baseAddress } = req.body;
  if (!VEHICLE_TYPES.includes(vehicleType)) {
    res.status(400);
    throw new Error('Please choose a valid vehicle type.');
  }
  const existing = await Courier.findOne({ user: req.user._id });
  if (existing) {
    res.status(409);
    throw new Error('You already have a courier profile.');
  }
  const courier = await Courier.create({
    user: req.user._id,
    vehicleType,
    vehiclePlate,
    serviceRadiusKm: serviceRadiusKm || 15,
    baseLocation,
    baseAddress,
  });
  res.status(201).json({ success: true, data: courier });
});

// @desc  My courier profile
// @route GET /api/couriers/me
const getMyCourierProfile = asyncHandler(async (req, res) => {
  const courier = await Courier.findOne({ user: req.user._id });
  res.json({ success: true, data: courier });
});

// @desc  Update my courier profile (vehicle, service area, etc.)
// @route PUT /api/couriers/me
const updateMyCourierProfile = asyncHandler(async (req, res) => {
  const courier = await Courier.findOne({ user: req.user._id });
  if (!courier) {
    res.status(404);
    throw new Error('You do not have a courier profile yet.');
  }
  const { vehicleType, vehiclePlate, serviceRadiusKm, baseLocation, baseAddress } = req.body;
  if (vehicleType && VEHICLE_TYPES.includes(vehicleType)) courier.vehicleType = vehicleType;
  if (vehiclePlate !== undefined) courier.vehiclePlate = vehiclePlate;
  if (serviceRadiusKm !== undefined) courier.serviceRadiusKm = serviceRadiusKm;
  if (baseLocation) courier.baseLocation = baseLocation;
  if (baseAddress !== undefined) courier.baseAddress = baseAddress;
  await courier.save();
  res.json({ success: true, data: courier });
});

// @desc  Toggle "on shift" availability
// @route PUT /api/couriers/me/availability
const setAvailability = asyncHandler(async (req, res) => {
  const courier = await Courier.findOne({ user: req.user._id });
  if (!courier) {
    res.status(404);
    throw new Error('You do not have a courier profile yet.');
  }
  courier.isAvailable = !!req.body.isAvailable;
  await courier.save();
  res.json({ success: true, data: courier });
});

// @desc  Submit (or resubmit) KYC for review — permit + national ID
// @route POST /api/couriers/me/verification/request
const requestVerification = asyncHandler(async (req, res) => {
  const courier = await Courier.findOne({ user: req.user._id });
  if (!courier) {
    res.status(404);
    throw new Error('You do not have a courier profile yet.');
  }
  if (courier.verification.status === COURIER_VERIFICATION_STATUS.VERIFIED) {
    res.status(400);
    throw new Error('You are already verified.');
  }
  if (courier.verification.status === COURIER_VERIFICATION_STATUS.PENDING) {
    res.status(400);
    throw new Error('Your verification request is already pending review.');
  }
  courier.verification.status = COURIER_VERIFICATION_STATUS.PENDING;
  courier.verification.requestNote = req.body.note || '';
  courier.verification.requestedAt = new Date();
  courier.verification.reviewedAt = undefined;
  courier.verification.reviewedBy = undefined;
  courier.verification.reviewNote = undefined;
  await courier.save();
  res.json({ success: true, data: courier });
});

// @desc  Upload KYC documents (permit + national ID photos)
// @route POST /api/couriers/me/verification/documents
const uploadVerificationDocuments = asyncHandler(async (req, res) => {
  const courier = await Courier.findOne({ user: req.user._id });
  if (!courier) {
    res.status(404);
    throw new Error('You do not have a courier profile yet.');
  }
  const files = req.files || [];
  courier.verification.documents.push(...files.map((f) => `/uploads/${f.filename}`));
  await courier.save();
  res.json({ success: true, data: courier });
});

// @desc  Super admin: list couriers with a pending verification request
// @route GET /api/couriers/verification/pending
const listPendingVerifications = asyncHandler(async (req, res) => {
  const couriers = await Courier.find({ 'verification.status': 'pending' }).populate('user', 'name email phone');
  res.json({ success: true, data: couriers });
});

// @desc  Super admin: list all couriers
// @route GET /api/couriers
const listCouriers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter['verification.status'] = req.query.status;
  const couriers = await Courier.find(filter).populate('user', 'name email phone');
  res.json({ success: true, data: couriers });
});

// @desc  Super admin: approve or reject a courier's KYC
// @route PUT /api/couriers/:id/verification/review
const reviewVerification = asyncHandler(async (req, res) => {
  const courier = await Courier.findById(req.params.id).populate('user', 'name');
  if (!courier) {
    res.status(404);
    throw new Error('Courier not found.');
  }
  const approve = req.body.action === 'approve';
  courier.verification.status = approve ? COURIER_VERIFICATION_STATUS.VERIFIED : COURIER_VERIFICATION_STATUS.REJECTED;
  courier.verification.reviewedAt = new Date();
  courier.verification.reviewedBy = req.user._id;
  courier.verification.reviewNote = req.body.note || '';
  await courier.save();

  await notify(courier.user._id, {
    type: approve ? 'courier_verified' : 'courier_verification_rejected',
    title: approve ? 'You are now a verified courier' : 'Verification request declined',
    body: approve
      ? 'You can now claim deliveries on Fundo.'
      : `Your courier verification was declined${req.body.note ? `: ${req.body.note}` : '.'}`,
    link: '/courier',
    sms: true,
  });

  res.json({ success: true, data: courier });
});

module.exports = {
  registerCourier,
  getMyCourierProfile,
  updateMyCourierProfile,
  setAvailability,
  requestVerification,
  uploadVerificationDocuments,
  listPendingVerifications,
  listCouriers,
  reviewVerification,
};
