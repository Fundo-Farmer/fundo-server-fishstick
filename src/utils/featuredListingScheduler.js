const cron = require('node-cron');
const MarketItem = require('../models/MarketItem');

const expireFeaturedListings = async () => {
  await MarketItem.updateMany(
    { isFeatured: true, featuredUntil: { $lte: new Date() } },
    { isFeatured: false }
  );
};

const startFeaturedListingScheduler = () => {
  // Hourly is plenty — featuring runs in whole-day windows.
  cron.schedule('30 * * * *', () => {
    expireFeaturedListings().catch((err) => console.error('[fundo] featured-listing scheduler error:', err.message));
  });
};

module.exports = { startFeaturedListingScheduler, expireFeaturedListings };
