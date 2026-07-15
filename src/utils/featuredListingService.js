const MarketItem = require('../models/MarketItem');
const PlatformRevenue = require('../models/PlatformRevenue');
const notify = require('./notify');
const { getSettings } = require('./settingsService');
const { PAYMENT_STATUS, PLATFORM_REVENUE_TYPE } = require('../config/constants');

/**
 * Shared entrypoint for the mock provider (and, eventually, a real webhook)
 * to report a featured-listing payment's outcome. Simpler than order/pre-order
 * payments: there's no counterparty seller to escrow anything for — Fundo is
 * the one being paid directly — so success just flips the listing featured.
 */
const handleFeatureListingPayment = async (providerRef, outcome) => {
  const item = await MarketItem.findOne({ featurePaymentRef: providerRef });
  if (!item) return;
  const settings = await getSettings();

  if (outcome === PAYMENT_STATUS.SUCCESSFUL) {
    const until = new Date();
    until.setDate(until.getDate() + settings.featuredListing.days);
    item.isFeatured = true;
    item.featuredUntil = until;
    item.featurePaymentRef = null;
    await item.save();

    await PlatformRevenue.create({
      type: PLATFORM_REVENUE_TYPE.FEATURED_LISTING,
      amount: settings.featuredListing.fee,
      farm: item.farm,
      marketItem: item._id,
      description: `Featured listing: ${item.title}`,
    });

    await notify(item.seller, {
      type: 'listing_featured',
      title: 'Your listing is now featured',
      body: `"${item.title}" will appear at the top of the shop for ${settings.featuredListing.days} days.`,
      link: `/shop/${item._id}`,
    });
  } else {
    item.featurePaymentRef = null;
    await item.save();
    await notify(item.seller, {
      type: 'listing_feature_failed',
      title: 'Featuring payment failed',
      body: `We couldn't process payment to feature "${item.title}". You can try again from your listing.`,
      link: `/shop/${item._id}`,
    });
  }
};

module.exports = { handleFeatureListingPayment };
