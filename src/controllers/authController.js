const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Farm = require('../models/Farm');
const generateToken = require('../utils/generateToken');
const { ROLES } = require('../config/constants');

// @desc  Register a new farm owner (creates a Farm + a farm_admin user)
// @route POST /api/auth/register-farm
const registerFarm = asyncHandler(async (req, res) => {
  const { name, email, password, phone, farmName, location } = req.body;
  if (!name || !email || !password || !farmName) {
    res.status(400);
    throw new Error('Name, email, password and farm name are required.');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error('An account with this email already exists.');
  }

  const user = await User.create({ name, email, password, phone, role: ROLES.FARM_ADMIN });
  const farm = await Farm.create({ name: farmName, owner: user._id, location, config: { displayName: farmName } });
  user.farm = farm._id;
  await user.save();

  res.status(201).json({
    success: true,
    token: generateToken(user._id),
    user: user.toSafeObject(),
    farm,
  });
});

// @desc  Register a customer (public shop/auction buyer & seller)
// @route POST /api/auth/register
const registerCustomer = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are required.');
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error('An account with this email already exists.');
  }
  const user = await User.create({ name, email, password, phone, role: ROLES.CUSTOMER });
  res.status(201).json({ success: true, token: generateToken(user._id), user: user.toSafeObject() });
});

// @desc  Login
// @route POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password.');
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact your farm admin.');
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ success: true, token: generateToken(user._id), user: user.toSafeObject() });
});

// @desc  Current logged-in user
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('farm');
  res.json({ success: true, user });
});

// @desc  Update own profile
// @route PUT /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, avatar, password } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (avatar) user.avatar = avatar;
  if (password) user.password = password;
  await user.save();
  res.json({ success: true, user: user.toSafeObject() });
});

module.exports = { registerFarm, registerCustomer, login, getMe, updateMe };
