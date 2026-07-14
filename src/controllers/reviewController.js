const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');
const notify = require('../utils/notify');
const { updateRatingsAfterReview } = require('../utils/ratingAggregation');
const { FINAL_SUCCESS_STATUSES, REVIEW_DIRECTION } = require('../config/constants');

const aggregateFor = async (matchStage) => {
  const [agg] = await Review.aggregate([
    { $match: matchStage },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return { average: agg ? Math.round(agg.average * 10) / 10 : null, count: agg ? agg.count : 0 };
};

// @desc  Leave a review on a fulfilled order (either direction)
// @route POST /api/reviews
const createReview = asyncHandler(async (req, res) => {
  const { orderId, rating, comment } = req.body;
  if (!orderId || !rating) {
    res.status(400);
    throw new Error('Order and rating are required.');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }

  const isBuyer = String(order.buyer) === String(req.user._id);
  const isSeller = String(order.seller) === String(req.user._id);
  if (!isBuyer && !isSeller) {
    res.status(403);
    throw new Error('You can only review orders you were part of.');
  }
  if (!FINAL_SUCCESS_STATUSES.includes(order.status)) {
    res.status(400);
    throw new Error('You can only review an order once it has been fulfilled.');
  }

  const direction = isBuyer ? REVIEW_DIRECTION.BUYER_TO_SELLER : REVIEW_DIRECTION.SELLER_TO_BUYER;
  const revieweeId = isBuyer ? order.seller : order.buyer;

  const existing = await Review.findOne({ order: orderId, direction });
  if (existing) {
    res.status(409);
    throw new Error('You have already reviewed this order.');
  }

  const reviewee = await User.findById(revieweeId);

  const review = await Review.create({
    order: orderId,
    direction,
    reviewer: req.user._id,
    reviewee: revieweeId,
    farm: reviewee?.farm || null,
    rating,
    comment,
  });

  await updateRatingsAfterReview(review);
  await notify(revieweeId, {
    type: 'review_received',
    title: `You received a ${rating}-star review`,
    body: comment || undefined,
    link: isBuyer ? '/my-listings' : '/orders',
  });

  res.status(201).json({ success: true, data: review });
});

// @desc  Reviews already left for an order (so the UI knows what's left to do)
// @route GET /api/reviews/order/:orderId
const getForOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (![String(order.buyer), String(order.seller)].includes(String(req.user._id))) {
    res.status(403);
    throw new Error('You cannot view reviews for this order.');
  }
  const reviews = await Review.find({ order: req.params.orderId });
  res.json({ success: true, data: reviews });
});

// @desc  Public: a user's reviews (as a seller or buyer) + average rating
// @route GET /api/reviews/user/:userId
const getForUser = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.params.userId);
  const direction = req.query.direction || REVIEW_DIRECTION.BUYER_TO_SELLER; // default: reviews of them as a seller
  const [{ average, count }, recent] = await Promise.all([
    aggregateFor({ reviewee: userId, direction }),
    Review.find({ reviewee: userId, direction }).sort({ createdAt: -1 }).limit(10).populate('reviewer', 'name'),
  ]);
  res.json({ success: true, data: { average, count, recent } });
});

// @desc  Public: a farm's aggregate rating as a seller
// @route GET /api/reviews/farm/:farmId
const getForFarm = asyncHandler(async (req, res) => {
  const farmId = new mongoose.Types.ObjectId(req.params.farmId);
  const [{ average, count }, recent] = await Promise.all([
    aggregateFor({ farm: farmId, direction: REVIEW_DIRECTION.BUYER_TO_SELLER }),
    Review.find({ farm: farmId, direction: REVIEW_DIRECTION.BUYER_TO_SELLER }).sort({ createdAt: -1 }).limit(10).populate('reviewer', 'name'),
  ]);
  res.json({ success: true, data: { average, count, recent } });
});

module.exports = { createReview, getForOrder, getForUser, getForFarm };
