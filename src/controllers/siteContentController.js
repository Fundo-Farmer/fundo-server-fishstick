const asyncHandler = require('express-async-handler');
const SiteContent = require('../models/SiteContent');

const VALID_KEYS = ['privacy_policy', 'terms_conditions', 'marketplace_policy', 'legal', 'about', 'careers', 'academy'];

// @desc  Public: get a content page by key
// @route GET /api/content/:key
const getContent = asyncHandler(async (req, res) => {
  if (!VALID_KEYS.includes(req.params.key)) {
    res.status(404);
    throw new Error('Page not found.');
  }
  const content = await SiteContent.findOne({ key: req.params.key });
  if (!content) {
    res.status(404);
    throw new Error('This page has not been published yet.');
  }
  res.json({ success: true, data: content });
});

// @desc  Super admin: list all content pages
// @route GET /api/content
const listContent = asyncHandler(async (req, res) => {
  const pages = await SiteContent.find().sort({ key: 1 });
  res.json({ success: true, data: pages });
});

// @desc  Super admin: create or update a content page
// @route PUT /api/content/:key
const upsertContent = asyncHandler(async (req, res) => {
  if (!VALID_KEYS.includes(req.params.key)) {
    res.status(400);
    throw new Error('Invalid page key.');
  }
  const { title, body } = req.body;
  if (!title || !body) {
    res.status(400);
    throw new Error('Title and body are required.');
  }
  const content = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { key: req.params.key, title, body, updatedBy: req.user._id },
    { upsert: true, new: true }
  );
  res.json({ success: true, data: content });
});

module.exports = { getContent, listContent, upsertContent };
