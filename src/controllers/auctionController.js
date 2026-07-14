const asyncHandler = require('express-async-handler');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Farm = require('../models/Farm');
const notify = require('../utils/notify');
const { AUCTION_STATUS, ROLES } = require('../config/constants');

const SELLER_FIELDS = 'name ratingAvg ratingCount';
const FARM_FIELDS = 'name config.logo verification.status certifications ratingAvg ratingCount';

const refreshStatus = (auction) => {
  const now = new Date();
  if (auction.status === AUCTION_STATUS.CANCELLED) return auction;
  if (now < auction.startTime) auction.status = AUCTION_STATUS.SCHEDULED;
  else if (now >= auction.startTime && now < auction.endTime) auction.status = AUCTION_STATUS.LIVE;
  else if (now >= auction.endTime && auction.status !== AUCTION_STATUS.ENDED) auction.status = AUCTION_STATUS.ENDED;
  return auction;
};

// @desc  Public: browse auctions
// @route GET /api/auctions
const listAuctions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.verifiedOnly === 'true') {
    const verifiedFarmIds = await Farm.find({ 'verification.status': 'verified' }).select('_id');
    filter.farm = { $in: verifiedFarmIds.map((f) => f._id) };
  }

  const SORTS = {
    ending_soon: { endTime: 1 },
    price_asc: { currentPrice: 1 },
    price_desc: { currentPrice: -1 },
  };
  const sort = SORTS[req.query.sort] || SORTS.ending_soon;

  const auctions = await Auction.find(filter).populate('seller', SELLER_FIELDS).populate('farm', FARM_FIELDS).sort(sort);
  auctions.forEach(refreshStatus);
  await Promise.all(auctions.map((a) => a.save()));
  res.json({ success: true, data: auctions });
});

// @desc  Get single auction with bid history
// @route GET /api/auctions/:id
const getAuction = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id).populate('seller', SELLER_FIELDS).populate('farm', FARM_FIELDS).populate('winner', 'name');
  if (!auction) {
    res.status(404);
    throw new Error('Auction not found.');
  }
  refreshStatus(auction);
  await auction.save();
  const bids = await Bid.find({ auction: auction._id }).populate('bidder', 'name').sort({ amount: -1 }).limit(50);
  res.json({ success: true, data: { auction, bids } });
});

// @desc  Create an auction listing
// @route POST /api/auctions
const createAuction = asyncHandler(async (req, res) => {
  const { title, description, category, images, startingPrice, bidIncrement, startTime, endTime } = req.body;
  if (!title || !startingPrice || !startTime || !endTime) {
    res.status(400);
    throw new Error('Title, starting price, start time and end time are required.');
  }
  if (new Date(endTime) <= new Date(startTime)) {
    res.status(400);
    throw new Error('End time must be after start time.');
  }
  const auction = await Auction.create({
    seller: req.user._id,
    farm: req.user.farm || null,
    title,
    description,
    category,
    images: images || [],
    startingPrice,
    currentPrice: startingPrice,
    bidIncrement: bidIncrement || 1000,
    startTime,
    endTime,
  });
  res.status(201).json({ success: true, data: auction });
});

// @desc  Attach photos to an auction
// @route POST /api/auctions/:id/photos
const uploadPhotos = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    res.status(404);
    throw new Error('Auction not found.');
  }
  if (String(auction.seller) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only edit your own auction.');
  }
  const files = req.files || [];
  auction.images.push(...files.map((f) => `/uploads/${f.filename}`));
  await auction.save();
  res.json({ success: true, data: auction });
});

// @desc  Place a bid
// @route POST /api/auctions/:id/bids
const placeBid = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    res.status(404);
    throw new Error('Auction not found.');
  }
  refreshStatus(auction);
  if (auction.status !== AUCTION_STATUS.LIVE) {
    res.status(400);
    throw new Error('This auction is not currently open for bidding.');
  }
  if (String(auction.seller) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot bid on your own auction.');
  }
  const { amount } = req.body;
  const minAcceptable = auction.currentPrice + (auction.highestBid ? auction.bidIncrement : 0);
  if (!amount || amount < minAcceptable) {
    res.status(400);
    throw new Error(`Bid must be at least ${minAcceptable}.`);
  }

  const previousHighestBid = auction.highestBid ? await Bid.findById(auction.highestBid) : null;

  const bid = await Bid.create({ auction: auction._id, bidder: req.user._id, amount });
  auction.currentPrice = amount;
  auction.highestBid = bid._id;
  await auction.save();

  if (previousHighestBid && String(previousHighestBid.bidder) !== String(req.user._id)) {
    await notify(previousHighestBid.bidder, {
      type: 'auction_outbid',
      title: 'You have been outbid',
      body: `Someone bid higher on "${auction.title}" — the price is now UGX ${amount.toLocaleString()}.`,
      link: `/auctions/${auction._id}`,
    });
  }

  res.status(201).json({ success: true, data: { auction, bid } });
});

// @desc  Cancel own auction (before it ends)
// @route PUT /api/auctions/:id/cancel
const cancelAuction = asyncHandler(async (req, res) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) {
    res.status(404);
    throw new Error('Auction not found.');
  }
  if (String(auction.seller) !== String(req.user._id) && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('You can only cancel your own auction.');
  }
  auction.status = AUCTION_STATUS.CANCELLED;
  await auction.save();
  res.json({ success: true, data: auction });
});

// @desc  My auctions
// @route GET /api/auctions/mine
const myAuctions = asyncHandler(async (req, res) => {
  const auctions = await Auction.find({ seller: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: auctions });
});

module.exports = {
  listAuctions,
  getAuction,
  createAuction,
  uploadPhotos,
  placeBid,
  cancelAuction,
  myAuctions,
  refreshStatus,
};
