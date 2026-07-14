const asyncHandler = require('express-async-handler');
const Farm = require('../models/Farm');
const User = require('../models/User');
const MarketItem = require('../models/MarketItem');
const Auction = require('../models/Auction');
const Livestock = require('../models/Livestock');
const Pet = require('../models/Pet');
const CoffeeGarden = require('../models/CoffeeGarden');
const Plantation = require('../models/Plantation');
const Courier = require('../models/Courier');
const Order = require('../models/Order');
const PreOrder = require('../models/PreOrder');
const PlatformRevenue = require('../models/PlatformRevenue');

const round2 = (n) => Math.round(n * 100) / 100;

const monthStarts = (n) => {
  const now = new Date();
  const starts = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    starts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return starts;
};
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const fillMonthly = (rows, months, valueField = 'total') => {
  const byKey = new Map(rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r[valueField]]));
  return months.map((d) => ({ month: monthKey(d), value: byKey.get(monthKey(d)) || 0 }));
};

// @desc  Platform-wide stats for the Fundo admin portal
// @route GET /api/admin/stats
const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    farms,
    activeFarms,
    pendingVerifications,
    pendingCourierVerifications,
    couriers,
    users,
    livestock,
    pets,
    coffeeGardens,
    plantations,
    listings,
    liveAuctions,
  ] = await Promise.all([
    Farm.countDocuments(),
    Farm.countDocuments({ isActive: true }),
    Farm.countDocuments({ 'verification.status': 'pending' }),
    Courier.countDocuments({ 'verification.status': 'pending' }),
    Courier.countDocuments({ 'verification.status': 'verified' }),
    User.countDocuments(),
    Livestock.countDocuments(),
    Pet.countDocuments(),
    CoffeeGarden.countDocuments(),
    Plantation.countDocuments(),
    MarketItem.countDocuments({ status: 'available' }),
    Auction.countDocuments({ status: 'live' }),
  ]);

  const usersByRole = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);

  res.json({
    success: true,
    data: {
      farms,
      activeFarms,
      pendingVerifications,
      pendingCourierVerifications,
      couriers,
      users,
      usersByRole,
      livestock,
      pets,
      coffeeGardens,
      plantations,
      listings,
      liveAuctions,
    },
  });
});

// @desc  Platform-wide analytics — GMV, take rate, active users, retention, revenue mix
// @route GET /api/admin/analytics
const getPlatformAnalytics = asyncHandler(async (req, res) => {
  const MONTHS_BACK = 6;
  const months = monthStarts(MONTHS_BACK);
  const since = months[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orderGmvRows, preOrderGmvRows, revenueRows, revenueByType, activeBuyerIds, activeSellerIds] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: '$total' } } },
    ]),
    PreOrder.aggregate([
      { $match: { paymentStatus: 'successful', createdAt: { $gte: since } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: '$total' } } },
    ]),
    PlatformRevenue.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, total: { $sum: '$amount' } } },
    ]),
    PlatformRevenue.aggregate([
      { $match: { date: { $gte: since } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    Order.distinct('buyer', { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } }),
    Order.distinct('seller', { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } }),
  ]);

  const orderGmv = fillMonthly(orderGmvRows, months);
  const preOrderGmv = fillMonthly(preOrderGmvRows, months);
  const gmvByMonth = months.map((d, i) => ({ month: monthKey(d), value: round2(orderGmv[i].value + preOrderGmv[i].value) }));
  const revenueByMonth = fillMonthly(revenueRows, months);

  const totalGmv = gmvByMonth.reduce((s, m) => s + m.value, 0);
  const totalRevenue = revenueByMonth.reduce((s, m) => s + m.value, 0);
  const takeRatePercent = totalGmv > 0 ? round2((totalRevenue / totalGmv) * 100) : 0;

  // Retention: of the buyers active in the month before last, what share also
  // ordered again last month? A simple month-over-month repeat-purchase rate —
  // not a cohort/LTV model, just the most legible retention signal available
  // from order history alone.
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const [priorMonthBuyers, lastMonthBuyers] = await Promise.all([
    Order.distinct('buyer', { paymentStatus: 'paid', createdAt: { $gte: twoMonthsAgoStart, $lt: lastMonthStart } }),
    Order.distinct('buyer', { paymentStatus: 'paid', createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } }),
  ]);
  const lastMonthSet = new Set(lastMonthBuyers.map(String));
  const retainedCount = priorMonthBuyers.filter((id) => lastMonthSet.has(String(id))).length;
  const retentionPercent = priorMonthBuyers.length > 0 ? round2((retainedCount / priorMonthBuyers.length) * 100) : 0;

  res.json({
    success: true,
    data: {
      gmvByMonth,
      revenueByMonth,
      revenueByType: revenueByType.map((r) => ({ type: r._id, total: r.total })),
      totalGmv: round2(totalGmv),
      totalRevenue: round2(totalRevenue),
      takeRatePercent,
      activeBuyers30d: activeBuyerIds.length,
      activeSellers30d: activeSellerIds.length,
      retentionPercent,
    },
  });
});

module.exports = { getPlatformStats, getPlatformAnalytics };
