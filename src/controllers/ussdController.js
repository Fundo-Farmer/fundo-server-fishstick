const asyncHandler = require('express-async-handler');
const UssdSession = require('../models/UssdSession');
const User = require('../models/User');
const Order = require('../models/Order');
const MarketItem = require('../models/MarketItem');
const Subscription = require('../models/Subscription');
const { createSingleItemOrder } = require('../utils/orderCreation');
const { getOrCreateWallet } = require('../utils/walletService');
const { FULFILLMENT_TYPE, PAYMENT_METHOD } = require('../config/constants');

const CATEGORIES = ['livestock', 'coffee', 'pets', 'plantation', 'produce', 'other'];

const normalizePhone = (p) => (p || '').replace(/\D/g, '').slice(-9);

/**
 * Finds a Fundo account by phone number. USSD gateways send the full MSISDN
 * (e.g. "+256772123456"); our own User.phone field is free-text (could be
 * "0772123456" or "+256772123456") — comparing the last 9 digits is a
 * reasonably robust heuristic for East African numbers regardless of
 * leading 0 / country code formatting.
 */
const findUserByPhone = async (phoneNumber) => {
  const target = normalizePhone(phoneNumber);
  if (!target) return null;
  const candidates = await User.find({ phone: { $exists: true, $nin: [null, ''] } }).select('phone name role farm');
  return candidates.find((u) => normalizePhone(u.phone) === target) || null;
};

/**
 * Uganda mobile money numbers hint at network from their prefix — a small,
 * genuinely useful touch for pre-selecting MTN vs Airtel on a USSD purchase,
 * where there's no UI to ask. Defaults to MTN if the prefix isn't recognized.
 */
const inferMobileMoneyProvider = (phoneNumber) => {
  const local = normalizePhone(phoneNumber);
  const prefix = local.slice(0, 2);
  if (['70', '74', '75'].includes(prefix)) return 'airtel';
  return 'mtn';
};

const MAIN_MENU = 'Welcome to Fundo\n1. My orders\n2. Browse shop\n3. Wallet balance\n4. My subscriptions\n0. Exit';
const CATEGORY_MENU = 'Browse by category:\n1. Livestock\n2. Coffee\n3. Pets\n4. Plantation\n5. Produce\n6. Other\n0. Back';

const con = (text) => ({ type: 'CON', text });
const end = (text) => ({ type: 'END', text });

// Every handler receives (session, input) and returns { type, text }, and may
// mutate session.menu / session.data — the caller persists it after.
const handlers = {
  async main(session, input) {
    if (input === '') return con(MAIN_MENU);
    if (input === '0') return end('Thanks for using Fundo. Goodbye!');

    if (input === '2') {
      session.menu = 'shop_categories';
      return con(CATEGORY_MENU);
    }

    if (!session.user) {
      return end("This phone number isn't linked to a Fundo account yet. Register at the Fundo app first, using this same number.");
    }

    if (input === '1') {
      const orders = await Order.find({ buyer: session.user }).sort({ createdAt: -1 }).limit(5);
      if (!orders.length) return end('You have no orders yet.');
      session.data.orderIds = orders.map((o) => String(o._id));
      session.menu = 'orders';
      const lines = orders.map((o, i) => `${i + 1}. #${String(o._id).slice(-6).toUpperCase()} UGX ${o.total.toLocaleString()} - ${o.status}`);
      return con(`Your recent orders:\n${lines.join('\n')}\n0. Back`);
    }

    if (input === '3') {
      const wallet = await getOrCreateWallet(session.user);
      return end(`Your Fundo wallet:\nAvailable: UGX ${wallet.balanceAvailable.toLocaleString()}\nPending: UGX ${wallet.balancePending.toLocaleString()}`);
    }

    if (input === '4') {
      const subs = await Subscription.find({ buyer: session.user, status: { $ne: 'cancelled' } })
        .populate('marketItem', 'title')
        .limit(5);
      if (!subs.length) return end('You have no active subscriptions.');
      session.data.subscriptionIds = subs.map((s) => String(s._id));
      session.menu = 'subscriptions';
      const lines = subs.map((s, i) => `${i + 1}. ${s.marketItem?.title || 'Item'} x${s.quantity} (${s.frequency}) - ${s.status}`);
      return con(`Your subscriptions:\n${lines.join('\n')}\n0. Back`);
    }

    return con(`Invalid choice.\n${MAIN_MENU}`);
  },

  async orders(session, input) {
    if (input === '0' || !session.data.orderIds) {
      session.menu = 'main';
      return con(MAIN_MENU);
    }
    const idx = Number(input) - 1;
    const orderId = session.data.orderIds[idx];
    if (!orderId) return con(`Invalid choice. Reply 0 to go back.`);
    const order = await Order.findById(orderId);
    if (!order) return end('That order could not be found.');
    const itemLines = order.items.map((i) => `${i.title} x${i.quantity}`).join(', ');
    return end(`Order #${String(order._id).slice(-6).toUpperCase()}\n${itemLines}\nTotal: UGX ${order.total.toLocaleString()}\nStatus: ${order.status.replace(/_/g, ' ')}`);
  },

  async subscriptions(session, input) {
    if (input === '0' || !session.data.subscriptionIds) {
      session.menu = 'main';
      return con(MAIN_MENU);
    }
    const idx = Number(input) - 1;
    const subId = session.data.subscriptionIds[idx];
    if (!subId) return con('Invalid choice. Reply 0 to go back.');
    const sub = await Subscription.findById(subId).populate('marketItem', 'title');
    if (!sub) return end('That subscription could not be found.');
    session.data.activeSubscriptionId = subId;
    session.menu = 'subscription_detail';
    return con(`${sub.marketItem?.title || 'Item'} x${sub.quantity} (${sub.frequency})\nStatus: ${sub.status}\n1. ${sub.status === 'paused' ? 'Resume' : 'Pause'}\n2. Cancel\n0. Back`);
  },

  async subscription_detail(session, input) {
    const subId = session.data.activeSubscriptionId;
    const sub = subId && (await Subscription.findById(subId));
    if (input === '0' || !sub) {
      session.menu = 'main';
      return con(MAIN_MENU);
    }
    if (input === '1') {
      sub.status = sub.status === 'paused' ? 'active' : 'paused';
      await sub.save();
      return end(`Subscription ${sub.status === 'paused' ? 'paused' : 'resumed'}.`);
    }
    if (input === '2') {
      sub.status = 'cancelled';
      await sub.save();
      return end('Subscription cancelled.');
    }
    return con('Invalid choice.\n1. Toggle pause/resume\n2. Cancel\n0. Back');
  },

  async shop_categories(session, input) {
    if (input === '0') {
      session.menu = 'main';
      return con(MAIN_MENU);
    }
    const idx = Number(input) - 1;
    const category = CATEGORIES[idx];
    if (!category) return con(`Invalid choice.\n${CATEGORY_MENU}`);

    const listings = await MarketItem.find({ status: 'available', category }).sort({ createdAt: -1 }).limit(5);
    if (!listings.length) return con(`No listings in this category right now.\n0. Back`);
    session.data.listingIds = listings.map((l) => String(l._id));
    session.menu = 'shop_listings';
    const lines = listings.map((l, i) => `${i + 1}. ${l.title} - UGX ${l.price.toLocaleString()}`);
    return con(`${lines.join('\n')}\n0. Back`);
  },

  async shop_listings(session, input) {
    if (input === '0' || !session.data.listingIds) {
      session.menu = 'shop_categories';
      return con(CATEGORY_MENU);
    }
    const idx = Number(input) - 1;
    const listingId = session.data.listingIds[idx];
    if (!listingId) return con('Invalid choice. Reply 0 to go back.');
    const listing = await MarketItem.findById(listingId).populate('seller', 'name');
    if (!listing || listing.status !== 'available') return con('That listing is no longer available.\n0. Back');
    session.data.activeListingId = listingId;
    session.menu = 'shop_item';
    return con(`${listing.title}\nUGX ${listing.price.toLocaleString()} - ${listing.quantity} ${listing.unit} available\nSold by ${listing.seller?.name || 'a Fundo seller'}\n1. Buy now (pickup, mobile money)\n0. Back`);
  },

  async shop_item(session, input) {
    const listingId = session.data.activeListingId;
    if (input === '0' || !listingId) {
      session.menu = 'shop_categories';
      return con(CATEGORY_MENU);
    }
    if (input !== '1') return con('Invalid choice.\n1. Buy now\n0. Back');

    if (!session.user) {
      return end("This phone number isn't linked to a Fundo account yet. Register at the Fundo app first, using this same number.");
    }
    const listing = await MarketItem.findById(listingId);
    if (!listing || listing.status !== 'available') return end('Sorry, this listing just sold out.');
    if (String(listing.seller) === String(session.user)) return end("You can't buy your own listing.");

    session.menu = 'confirm_purchase';
    return con(`Buy ${listing.title} for UGX ${listing.price.toLocaleString()}?\nPayment via mobile money to ${session.phoneNumber}.\n1. Confirm\n0. Cancel`);
  },

  async confirm_purchase(session, input) {
    const listingId = session.data.activeListingId;
    if (input !== '1' || !listingId) {
      session.menu = 'main';
      return con(`Purchase cancelled.\n${MAIN_MENU}`);
    }
    const listing = await MarketItem.findById(listingId);
    if (!listing || listing.status !== 'available') return end('Sorry, this listing just sold out.');

    const result = await createSingleItemOrder({
      marketItem: listing._id,
      seller: listing.seller,
      buyer: session.user,
      quantity: 1,
      fulfillmentType: FULFILLMENT_TYPE.PICKUP,
      pickupNote: 'Arranged via USSD — buyer will contact seller.',
      buyerContact: session.phoneNumber,
      paymentMethod: PAYMENT_METHOD.MOBILE_MONEY,
      paymentProvider: inferMobileMoneyProvider(session.phoneNumber),
      phoneNumber: session.phoneNumber,
      source: 'ussd',
    });

    if (result.skipped) return end(`Sorry — ${result.reason}`);
    return end('Order placed! Check your phone to approve the mobile money payment. Dial in again and check "My orders" for status.');
  },
};

// @desc  USSD gateway webhook — standard Africa's Talking-style request shape
// @route POST /api/ussd
const handleUssdRequest = asyncHandler(async (req, res) => {
  const { sessionId, phoneNumber, text } = req.body;
  if (!sessionId || !phoneNumber) {
    res.status(400);
    throw new Error('sessionId and phoneNumber are required.');
  }

  let session = await UssdSession.findOne({ sessionId });
  if (!session) {
    const user = await findUserByPhone(phoneNumber);
    session = await UssdSession.create({ sessionId, phoneNumber, user: user?._id || null });
  }

  const parts = (text || '').split('*');
  const input = parts[parts.length - 1];

  const handler = handlers[session.menu] || handlers.main;
  const result = await handler(session, input);

  // `session.data` is a Mixed field, mutated in place by the handlers above
  // (e.g. `session.data.orderIds = [...]`) — Mongoose only auto-detects
  // whole-field reassignment on Mixed types, not nested mutation, so without
  // this the entire menu state would silently fail to save.
  session.markModified('data');
  await session.save();

  if (result.type === 'END') {
    await UssdSession.deleteOne({ _id: session._id });
  }

  // Aggregators expect a plain-text response, prefixed with CON (continue,
  // expect more input) or END (terminate the session).
  res.set('Content-Type', 'text/plain');
  res.send(`${result.type} ${result.text}`);
});

module.exports = { handleUssdRequest };
