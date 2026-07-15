const asyncHandler = require('express-async-handler');
const { getSettings, updateSettings } = require('../utils/settingsService');

// @desc  Get current platform settings
// @route GET /api/admin/settings
const getPlatformSettings = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ success: true, data: settings });
});

// @desc  Update platform settings (delivery pricing, commission, monetization)
// @route PUT /api/admin/settings
const updatePlatformSettings = asyncHandler(async (req, res) => {
  const settings = await updateSettings(req.body, req.user._id);
  res.json({ success: true, data: settings });
});

module.exports = { getPlatformSettings, updatePlatformSettings };
