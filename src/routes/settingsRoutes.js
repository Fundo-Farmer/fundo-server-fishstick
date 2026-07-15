const express = require('express');
const asyncHandler = require('express-async-handler');
const { getSettings } = require('../utils/settingsService');

const router = express.Router();

// @desc  Public: pricing-relevant settings (Premium plan fee, featured-listing fee, etc.)
// @route GET /api/settings/public
router.get('/public', asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({
    success: true,
    data: {
      platformCommissionPercent: settings.platformCommissionPercent,
      premiumPlan: settings.premiumPlan,
      featuredListing: settings.featuredListing,
    },
  });
}));

module.exports = router;
