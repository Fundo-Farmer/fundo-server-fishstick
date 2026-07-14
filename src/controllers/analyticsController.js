const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Order = require('../models/Order');
const SaleRecord = require('../models/SaleRecord');
const ExpenseRecord = require('../models/ExpenseRecord');
const ProduceRecord = require('../models/ProduceRecord');
const HarvestRecord = require('../models/HarvestRecord');
const Livestock = require('../models/Livestock');
const Pet = require('../models/Pet');

const MONTHS_BACK = 6;

const round2 = (n) => Math.round(n * 100) / 100;

/** Returns the first-of-month Date for each of the last `n` months, oldest first. */
const monthStarts = (n) => {
  const now = new Date();
  const starts = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    starts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  return starts;
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Groups an aggregation result keyed by {_id: {y, m}, total} onto a fixed set of month buckets, filling gaps with 0. */
const fillMonthly = (rows, months, valueField = 'total') => {
  const byKey = new Map(rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r[valueField]]));
  return months.map((d) => ({ month: monthKey(d), value: byKey.get(monthKey(d)) || 0 }));
};

// @desc  Analytics for the logged-in user's farm — sales, expenses, produce, growth
// @route GET /api/analytics/farm
const getFarmAnalytics = asyncHandler(async (req, res) => {
  if (!req.user.farm) {
    return res.json({ success: true, data: null });
  }
  const farmId = req.user.farm;
  const months = monthStarts(MONTHS_BACK);
  const since = months[0];

  const staff = await User.find({ farm: farmId }).select('_id');
  const staffIds = staff.map((s) => s._id);

  const [orderRevenueRows, saleRevenueRows, expenseRows, produceRows, harvestRows, newLivestockRows, newPetsRows, bestSellers] =
    await Promise.all([
      // Fundo shop revenue (what actually lands in the farm's wallet), by month
      Order.aggregate([
        { $match: { seller: { $in: staffIds }, paymentStatus: 'paid', createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: '$sellerAmount' } } },
      ]),
      // Manually logged sales (livestock/coffee/pets/plantation ledger entries), by month
      SaleRecord.aggregate([
        { $match: { farm: farmId, date: { $gte: since } } },
        { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, total: { $sum: '$total' } } },
      ]),
      ExpenseRecord.aggregate([
        { $match: { farm: farmId, date: { $gte: since } } },
        { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, total: { $sum: '$amount' } } },
      ]),
      ProduceRecord.aggregate([
        { $match: { farm: farmId, date: { $gte: since } } },
        { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, total: { $sum: '$quantity' } } },
      ]),
      HarvestRecord.aggregate([
        { $match: { farm: farmId, date: { $gte: since } } },
        { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, total: { $sum: '$quantity' } } },
      ]),
      Livestock.aggregate([
        { $match: { farm: farmId, createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: 1 } } },
      ]),
      Pet.aggregate([
        { $match: { farm: farmId, createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { seller: { $in: staffIds }, paymentStatus: 'paid', createdAt: { $gte: since } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.title', revenue: { $sum: '$items.subtotal' }, quantity: { $sum: '$items.quantity' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

  const shopRevenue = fillMonthly(orderRevenueRows, months);
  const ledgerRevenue = fillMonthly(saleRevenueRows, months);
  const combinedRevenue = months.map((d, i) => ({
    month: monthKey(d),
    value: round2(shopRevenue[i].value + ledgerRevenue[i].value),
  }));

  // A simple 3-month moving average, clearly labeled as a trend estimate —
  // not a real forecasting model, just "what the recent trend suggests."
  const lastThree = combinedRevenue.slice(-3).map((m) => m.value);
  const projectedNextMonth = lastThree.length ? round2(lastThree.reduce((s, v) => s + v, 0) / lastThree.length) : 0;

  res.json({
    success: true,
    data: {
      monthlyRevenue: combinedRevenue,
      monthlyShopRevenue: shopRevenue,
      monthlyLedgerRevenue: ledgerRevenue,
      monthlyExpenses: fillMonthly(expenseRows, months),
      monthlyProduce: fillMonthly(produceRows, months),
      monthlyHarvests: fillMonthly(harvestRows, months),
      newLivestock: fillMonthly(newLivestockRows, months),
      newPets: fillMonthly(newPetsRows, months),
      bestSellers: bestSellers.map((b) => ({ title: b._id, revenue: b.revenue, quantity: b.quantity })),
      projectedNextMonthRevenue: projectedNextMonth,
    },
  });
});

module.exports = { getFarmAnalytics };
