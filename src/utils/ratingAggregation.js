const Review = require('../models/Review');
const User = require('../models/User');
const Farm = require('../models/Farm');
const { REVIEW_DIRECTION } = require('../config/constants');

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Recomputes the reviewee's aggregate rating (as a buyer or seller, matching the
 * review's direction) from scratch. Recomputing on every review — rather than
 * incrementally updating a running average — keeps this simple and always
 * correct, and review volume per user is low enough that this is cheap.
 */
const updateRatingsAfterReview = async (review) => {
  const [userAgg] = await Review.aggregate([
    { $match: { reviewee: review.reviewee, direction: review.direction } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (userAgg) {
    await User.findByIdAndUpdate(review.reviewee, {
      ratingAvg: round1(userAgg.average),
      ratingCount: userAgg.count,
    });
  }

  // Farm-level aggregate only makes sense for reviews of a farm as a seller.
  if (review.direction === REVIEW_DIRECTION.BUYER_TO_SELLER && review.farm) {
    const [farmAgg] = await Review.aggregate([
      { $match: { farm: review.farm, direction: REVIEW_DIRECTION.BUYER_TO_SELLER } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (farmAgg) {
      await Farm.findByIdAndUpdate(review.farm, {
        ratingAvg: round1(farmAgg.average),
        ratingCount: farmAgg.count,
      });
    }
  }
};

module.exports = { updateRatingsAfterReview };
