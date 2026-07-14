const asyncHandler = require('express-async-handler');
const WishlistItem = require('../models/WishlistItem');
const MarketItem = require('../models/MarketItem');

// @desc  My wishlist
// @route GET /api/wishlist
const listMine = asyncHandler(async (req, res) => {
  const items = await WishlistItem.find({ user: req.user._id })
    .populate({ path: 'marketItem', populate: [{ path: 'seller', select: 'name' }, { path: 'farm', select: 'name verification.status' }] })
    .sort({ createdAt: -1 });
  res.json({ success: true, data: items });
});

// @desc  Add a listing to my wishlist
// @route POST /api/wishlist/:marketItemId
const add = asyncHandler(async (req, res) => {
  const marketItem = await MarketItem.findById(req.params.marketItemId);
  if (!marketItem) {
    res.status(404);
    throw new Error('Listing not found.');
  }
  if (String(marketItem.seller) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot wishlist your own listing.');
  }
  const existing = await WishlistItem.findOne({ user: req.user._id, marketItem: marketItem._id });
  if (existing) return res.json({ success: true, data: existing });

  const item = await WishlistItem.create({ user: req.user._id, marketItem: marketItem._id, priceWhenAdded: marketItem.price });
  res.status(201).json({ success: true, data: item });
});

// @desc  Remove a listing from my wishlist
// @route DELETE /api/wishlist/:marketItemId
const remove = asyncHandler(async (req, res) => {
  await WishlistItem.findOneAndDelete({ user: req.user._id, marketItem: req.params.marketItemId });
  res.json({ success: true, message: 'Removed from wishlist.' });
});

module.exports = { listMine, add, remove };
