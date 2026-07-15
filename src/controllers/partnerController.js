const asyncHandler = require('express-async-handler');
const Partner = require('../models/Partner');

// @desc  Public: list active partners (empty array if none — homepage hides the section)
// @route GET /api/partners
const listPartners = asyncHandler(async (req, res) => {
  const partners = await Partner.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data: partners });
});

// @desc  Super admin: list all partners (any status)
// @route GET /api/partners/all
const listAllPartners = asyncHandler(async (req, res) => {
  const partners = await Partner.find().sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data: partners });
});

// @desc  Super admin: add a partner
// @route POST /api/partners
const createPartner = asyncHandler(async (req, res) => {
  const { name, websiteUrl, order } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Partner name is required.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('A logo image is required.');
  }
  const partner = await Partner.create({
    name, websiteUrl, order, createdBy: req.user._id, logo: `/uploads/${req.file.filename}`,
  });
  res.status(201).json({ success: true, data: partner });
});

// @desc  Super admin: update a partner
// @route PUT /api/partners/:id
const updatePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findById(req.params.id);
  if (!partner) {
    res.status(404);
    throw new Error('Partner not found.');
  }
  const { name, websiteUrl, order, isActive } = req.body;
  if (name) partner.name = name;
  if (websiteUrl !== undefined) partner.websiteUrl = websiteUrl;
  if (order !== undefined) partner.order = order;
  if (isActive !== undefined) partner.isActive = isActive;
  if (req.file) partner.logo = `/uploads/${req.file.filename}`;
  await partner.save();
  res.json({ success: true, data: partner });
});

// @desc  Super admin: remove a partner
// @route DELETE /api/partners/:id
const deletePartner = asyncHandler(async (req, res) => {
  await Partner.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Partner removed.' });
});

module.exports = { listPartners, listAllPartners, createPartner, updatePartner, deletePartner };
