const cron = require('node-cron');
const Auction = require('../models/Auction');
const notify = require('./notify');
const { AUCTION_STATUS } = require('../config/constants');

const closeExpiredAuctions = async () => {
  const now = new Date();
  const expiring = await Auction.find({
    status: { $in: [AUCTION_STATUS.LIVE, AUCTION_STATUS.SCHEDULED] },
    endTime: { $lte: now },
  }).populate('highestBid');

  for (const auction of expiring) {
    auction.status = AUCTION_STATUS.ENDED;
    if (auction.highestBid) auction.winner = auction.highestBid.bidder;
    // eslint-disable-next-line no-await-in-loop
    await auction.save();

    if (auction.winner) {
      // eslint-disable-next-line no-await-in-loop
      await notify(auction.winner, {
        type: 'auction_won',
        title: 'You won the auction!',
        body: `"${auction.title}" is yours for UGX ${auction.currentPrice.toLocaleString()}. Contact the seller to arrange payment and pickup.`,
        link: `/auctions/${auction._id}`,
        sms: true,
      });
      // eslint-disable-next-line no-await-in-loop
      await notify(auction.seller, {
        type: 'auction_ended',
        title: 'Your auction ended',
        body: `"${auction.title}" sold for UGX ${auction.currentPrice.toLocaleString()}.`,
        link: `/auctions/${auction._id}`,
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await notify(auction.seller, {
        type: 'auction_ended',
        title: 'Your auction ended with no bids',
        body: `"${auction.title}" closed without any bids.`,
        link: `/auctions/${auction._id}`,
      });
    }
  }

  const toActivate = await Auction.find({
    status: AUCTION_STATUS.SCHEDULED,
    startTime: { $lte: now },
    endTime: { $gt: now },
  });
  for (const auction of toActivate) {
    auction.status = AUCTION_STATUS.LIVE;
    // eslint-disable-next-line no-await-in-loop
    await auction.save();
  }
};

const startAuctionScheduler = () => {
  // Runs every minute
  cron.schedule('* * * * *', () => {
    closeExpiredAuctions().catch((err) => console.error('[fundo] auction scheduler error:', err.message));
  });
};

module.exports = { startAuctionScheduler, closeExpiredAuctions };
