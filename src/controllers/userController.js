const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const notify = require('../utils/notify');
const { ROLES } = require('../config/constants');

// @desc  List users (super_admin: all users w/ optional ?farm=; farm_admin: own farm's staff)
// @route GET /api/users
const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === ROLES.SUPER_ADMIN) {
    if (req.query.farm) filter.farm = req.query.farm;
    if (req.query.role) filter.role = req.query.role;
  } else if (req.user.role === ROLES.FARM_ADMIN) {
    filter.farm = req.user.farm;
    filter.role = { $in: [ROLES.FARM_ADMIN, ROLES.WORKER] };
  } else {
    res.status(403);
    throw new Error('You do not have permission to list users.');
  }
  const users = await User.find(filter).populate('farm', 'name');
  res.json({ success: true, data: users });
});

// @desc  Farm admin creates a worker account for their farm
// @route POST /api/users/worker
const createWorker = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required.');
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error('A user with this email already exists.');
  }
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.WORKER,
    farm: req.user.farm,
  });

  await notify(user._id, {
    type: 'worker_added',
    title: 'Welcome to the farm',
    body: `You've been added as a worker. Log in with your email to get started.`,
    link: '/dashboard',
  });

  res.status(201).json({ success: true, data: user.toSafeObject() });
});

// @desc  Update a user's role/status/farm assignment (scoped)
// @route PUT /api/users/:id
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found.');
  }

  if (req.user.role === ROLES.FARM_ADMIN) {
    if (String(user.farm) !== String(req.user.farm)) {
      res.status(403);
      throw new Error('You can only manage staff on your own farm.');
    }
    if (req.body.name) user.name = req.body.name;
    if (req.body.phone) user.phone = req.body.phone;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    // farm_admin cannot escalate roles beyond worker/farm_admin on own farm
    if (req.body.role && [ROLES.WORKER, ROLES.FARM_ADMIN].includes(req.body.role)) {
      user.role = req.body.role;
    }
  } else if (req.user.role === ROLES.SUPER_ADMIN) {
    Object.assign(user, {
      name: req.body.name ?? user.name,
      phone: req.body.phone ?? user.phone,
      role: req.body.role ?? user.role,
      farm: req.body.farm ?? user.farm,
      isActive: req.body.isActive ?? user.isActive,
    });
  } else {
    res.status(403);
    throw new Error('You do not have permission to update users.');
  }

  await user.save();
  res.json({ success: true, data: user.toSafeObject() });
});

// @desc  Remove/deactivate a user
// @route DELETE /api/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found.');
  }
  if (req.user.role === ROLES.FARM_ADMIN && String(user.farm) !== String(req.user.farm)) {
    res.status(403);
    throw new Error('You can only manage staff on your own farm.');
  }
  await user.deleteOne();
  res.json({ success: true, message: 'User removed.' });
});

module.exports = { listUsers, createWorker, updateUser, deleteUser };
