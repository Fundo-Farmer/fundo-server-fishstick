const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const MarketItem = require('../models/MarketItem');
const Delivery = require('../models/Delivery');
const { quoteDelivery, getSellerPickupPoint } = require('./geo');
const { getProvider } = require('./paymentProviders');
const notify = require('./notify');
const {
  LISTING_STATUS, ORDER_STATUS, ORDER_PAYMENT_STATUS, FULFILLMENT_TYPE, PAYMENT_METHOD, PAYMENT_PROVIDER,
} = require('../config/constants');

/**
 * Places one order for a single listing + quantity. Returns
 * `{ skipped: true, reason }` if the listing can't fulfil it right now
 * (removed, sold out, insufficient stock) rather than throwing — callers that
 * process many of these in a loop (the subscription scheduler) shouldn't have
 * one bad cycle crash the rest.
 *
 * Takes a plain object shaped like `{ marketItem, seller, buyer, quantity,
 * fulfillmentType, deliveryAddress, deliveryCoordinates, pickupNote,
 * buyerContact, paymentMethod, paymentProvider, phoneNumber, source }` — not
 * necessarily a real `Subscription` document, which is why both the
 * subscription scheduler and the USSD purchase flow share this. `source` is
 * just a short label ('subscription' | 'ussd') used to word the buyer note
 * and notifications appropriately.
 */
const createSingleItemOrder = async (spec) => {
  const item = await MarketItem.findById(spec.marketItem);
  if (!item || item.status !== LISTING_STATUS.AVAILABLE) {
    return { skipped: true, reason: 'This listing is no longer available.' };
  }
  if (item.quantity < spec.quantity) {
    return { skipped: true, reason: `Only ${item.quantity} ${item.unit} left — less than requested.` };
  }

  const subtotal = Number((item.price * spec.quantity).toFixed(2));

  let deliveryFee = 0;
  let pickupPoint = null;
  let quote = null;
  if (spec.fulfillmentType === FULFILLMENT_TYPE.DELIVERY) {
    pickupPoint = await getSellerPickupPoint(spec.seller);
    quote = await quoteDelivery(pickupPoint, spec.deliveryCoordinates || {});
    deliveryFee = quote.fee;
  }

  const source = spec.source || 'subscription';
  const buyerNoteBySource = {
    subscription: 'Placed automatically from a subscription.',
    ussd: 'Placed via USSD.',
  };

  const order = await Order.create({
    groupId: uuidv4(),
    buyer: spec.buyer,
    seller: spec.seller,
    items: [{
      marketItem: item._id,
      title: item.title,
      image: item.images?.[0] || null,
      priceEach: item.price,
      quantity: spec.quantity,
      unit: item.unit,
      subtotal,
    }],
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    fulfillmentType: spec.fulfillmentType,
    deliveryAddress: spec.fulfillmentType === FULFILLMENT_TYPE.DELIVERY ? spec.deliveryAddress : undefined,
    deliveryCoordinates: spec.fulfillmentType === FULFILLMENT_TYPE.DELIVERY ? spec.deliveryCoordinates : undefined,
    pickupNote: spec.fulfillmentType === FULFILLMENT_TYPE.PICKUP ? spec.pickupNote : undefined,
    buyerContact: spec.buyerContact,
    buyerNotes: buyerNoteBySource[source] || buyerNoteBySource.subscription,
    paymentStatus: ORDER_PAYMENT_STATUS.PENDING,
    status: ORDER_STATUS.PLACED,
    statusHistory: [{ status: ORDER_STATUS.PLACED }],
  });

  if (spec.fulfillmentType === FULFILLMENT_TYPE.DELIVERY) {
    const delivery = await Delivery.create({
      order: order._id,
      seller: spec.seller,
      buyer: spec.buyer,
      pickup: { address: pickupPoint.address, lat: pickupPoint.lat, lng: pickupPoint.lng },
      dropoff: { address: spec.deliveryAddress, lat: spec.deliveryCoordinates?.lat, lng: spec.deliveryCoordinates?.lng },
      zone: quote.zone,
      distanceKm: quote.distanceKm,
      fee: quote.fee,
      allowedVehicleTypes: quote.allowedVehicleTypes,
      estimatedDays: quote.estimatedDays,
    });
    order.delivery = delivery._id;
    await order.save();
  }

  item.quantity -= spec.quantity;
  if (item.quantity <= 0) {
    item.quantity = 0;
    item.status = LISTING_STATUS.SOLD;
  }
  await item.save();

  const provider = spec.paymentMethod === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : spec.paymentProvider;
  const { providerRef } = await getProvider(provider).initiate({ phoneNumber: spec.phoneNumber });
  const payment = await Payment.create({
    buyer: spec.buyer,
    groupId: order.groupId,
    orders: [order._id],
    amount: order.total,
    method: spec.paymentMethod,
    provider,
    phoneNumber: spec.paymentMethod === PAYMENT_METHOD.MOBILE_MONEY ? spec.phoneNumber : undefined,
    providerRef,
  });
  order.payment = payment._id;
  await order.save();

  const sellerTitleBySource = { subscription: 'New subscription order', ussd: 'New order placed via USSD' };
  await notify(spec.seller, {
    type: 'order_placed',
    title: sellerTitleBySource[source] || sellerTitleBySource.subscription,
    body: `An order worth UGX ${order.total.toLocaleString()} has been placed — awaiting payment confirmation.`,
    link: `/orders/${order._id}`,
    sms: true,
  });
  await notify(spec.buyer, {
    type: source === 'ussd' ? 'ussd_order_placed' : 'subscription_order_placed',
    title: 'Your order was placed',
    body: `"${item.title}" × ${spec.quantity} — check your phone to confirm payment.`,
    link: `/orders/${order._id}`,
    sms: true,
  });

  return { skipped: false, order };
};

module.exports = { createSingleItemOrder };
