const asyncHandler = require('express-async-handler');
const Cart = require('../models/Cart');
const MarketItem = require('../models/MarketItem');
const { LISTING_STATUS } = require('../config/constants');

const getOrCreateCart = async (buyerId) => {
  let cart = await Cart.findOne({ buyer: buyerId });
  if (!cart) cart = await Cart.create({ buyer: buyerId, items: [] });
  return cart;
};

const populateCart = (cart) =>
  cart.populate({
    path: 'items.marketItem',
    select: 'title price quantity unit images status seller farm category',
    populate: { path: 'seller', select: 'name' },
  });

// @desc  Get the current user's cart
// @route GET /api/cart
const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  await populateCart(cart);
  res.json({ success: true, data: cart });
});

// @desc  Add an item to the cart (or increase its quantity)
// @route POST /api/cart/items
const addItem = asyncHandler(async (req, res) => {
  const { marketItem: marketItemId, quantity = 1 } = req.body;
  const listing = await MarketItem.findById(marketItemId);
  if (!listing || listing.status !== LISTING_STATUS.AVAILABLE) {
    res.status(400);
    throw new Error('This listing is not available.');
  }
  if (String(listing.seller) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot buy your own listing.');
  }

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => String(i.marketItem) === String(marketItemId));
  const requestedQty = (existing?.quantity || 0) + Number(quantity);
  if (requestedQty > listing.quantity) {
    res.status(400);
    throw new Error(`Only ${listing.quantity} ${listing.unit} available.`);
  }

  if (existing) existing.quantity = requestedQty;
  else cart.items.push({ marketItem: marketItemId, quantity: Number(quantity) });

  await cart.save();
  await populateCart(cart);
  res.status(201).json({ success: true, data: cart });
});

// @desc  Update an item's quantity in the cart
// @route PUT /api/cart/items/:marketItemId
const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await getOrCreateCart(req.user._id);
  const line = cart.items.find((i) => String(i.marketItem) === String(req.params.marketItemId));
  if (!line) {
    res.status(404);
    throw new Error('Item not in cart.');
  }
  if (Number(quantity) <= 0) {
    cart.items = cart.items.filter((i) => String(i.marketItem) !== String(req.params.marketItemId));
  } else {
    const listing = await MarketItem.findById(req.params.marketItemId);
    if (listing && Number(quantity) > listing.quantity) {
      res.status(400);
      throw new Error(`Only ${listing.quantity} ${listing.unit} available.`);
    }
    line.quantity = Number(quantity);
  }
  await cart.save();
  await populateCart(cart);
  res.json({ success: true, data: cart });
});

// @desc  Remove an item from the cart
// @route DELETE /api/cart/items/:marketItemId
const removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((i) => String(i.marketItem) !== String(req.params.marketItemId));
  await cart.save();
  await populateCart(cart);
  res.json({ success: true, data: cart });
});

// @desc  Empty the cart
// @route DELETE /api/cart
const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json({ success: true, data: cart });
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
