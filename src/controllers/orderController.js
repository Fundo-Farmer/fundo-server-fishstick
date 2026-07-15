const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const MarketItem = require('../models/MarketItem');
const Delivery = require('../models/Delivery');
const { restockListing } = require('../utils/inventorySync');
const { reversePendingForOrder, refundDeliveryFeeToBuyer } = require('../utils/walletService');
const { applyOrderStatusChange } = require('../utils/orderFulfillment');
const { getProvider } = require('../utils/paymentProviders');
const { quoteDelivery, getSellerPickupPoint } = require('../utils/geo');
const notify = require('../utils/notify');
const {
  LISTING_STATUS, ORDER_STATUS, ORDER_FINAL_STATUSES, ORDER_STATUS_FLOW, FULFILLMENT_TYPE,
  PAYMENT_METHOD, PAYMENT_PROVIDER, ORDER_PAYMENT_STATUS, DELIVERY_STATUS,
} = require('../config/constants');

// @desc  Preview delivery fees for the current cart before checking out
// @route POST /api/orders/quote-delivery
const quoteDeliveryForCart = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const cart = await Cart.findOne({ buyer: req.user._id }).populate('items.marketItem');
  if (!cart || cart.items.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const bySeller = new Map();
  cart.items.forEach((line) => {
    if (!line.marketItem) return;
    const sellerId = String(line.marketItem.seller);
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, true);
  });

  const quotes = await Promise.all(
    [...bySeller.keys()].map(async (sellerId) => {
      const pickup = await getSellerPickupPoint(sellerId);
      const quote = await quoteDelivery(pickup, { lat, lng });
      return { sellerId, ...quote };
    })
  );

  res.json({ success: true, data: quotes });
});

// @desc  Turn the current cart into one order per seller, then start payment
// @route POST /api/orders/checkout
const checkout = asyncHandler(async (req, res) => {
  const {
    fulfillmentType, deliveryAddress, deliveryCoordinates, pickupNote, buyerContact, buyerNotes,
    paymentMethod, paymentProvider, phoneNumber,
  } = req.body;

  if (!Object.values(FULFILLMENT_TYPE).includes(fulfillmentType)) {
    res.status(400);
    throw new Error('Please choose delivery or pickup.');
  }
  if (fulfillmentType === FULFILLMENT_TYPE.DELIVERY && !deliveryAddress) {
    res.status(400);
    throw new Error('A delivery address is required.');
  }
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    res.status(400);
    throw new Error('Please choose a payment method.');
  }
  if (paymentMethod === PAYMENT_METHOD.MOBILE_MONEY) {
    if (!['mtn', 'airtel'].includes(paymentProvider)) {
      res.status(400);
      throw new Error('Please choose MTN or Airtel for mobile money.');
    }
    if (!phoneNumber) {
      res.status(400);
      throw new Error('A phone number is required for mobile money payment.');
    }
  }

  const cart = await Cart.findOne({ buyer: req.user._id }).populate('items.marketItem');
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty.');
  }

  // Pass 1: validate every line is still available before changing anything.
  for (const line of cart.items) {
    const item = line.marketItem;
    if (!item || item.status !== LISTING_STATUS.AVAILABLE) {
      res.status(400);
      throw new Error(`"${item?.title || 'An item'}" is no longer available. Please remove it from your cart.`);
    }
    if (line.quantity > item.quantity) {
      res.status(400);
      throw new Error(`Only ${item.quantity} ${item.unit} of "${item.title}" left — please update the quantity in your cart.`);
    }
  }

  // Group cart lines by seller so each seller gets their own order.
  const bySeller = new Map();
  cart.items.forEach((line) => {
    const sellerId = String(line.marketItem.seller);
    if (!bySeller.has(sellerId)) bySeller.set(sellerId, []);
    bySeller.get(sellerId).push(line);
  });

  const groupId = uuidv4();
  const createdOrders = [];

  for (const [sellerId, lines] of bySeller.entries()) {
    const items = lines.map((line) => ({
      marketItem: line.marketItem._id,
      title: line.marketItem.title,
      image: line.marketItem.images?.[0] || null,
      priceEach: line.marketItem.price,
      quantity: line.quantity,
      unit: line.marketItem.unit,
      subtotal: Number((line.marketItem.price * line.quantity).toFixed(2)),
    }));
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

    // For delivery orders, price the delivery leg from this seller's farm (if
    // any) to the buyer's chosen point. Pickup orders never carry a delivery fee.
    let deliveryFee = 0;
    let pickupPoint = null;
    let quote = null;
    if (fulfillmentType === FULFILLMENT_TYPE.DELIVERY) {
      // eslint-disable-next-line no-await-in-loop
      pickupPoint = await getSellerPickupPoint(sellerId);
      quote = await quoteDelivery(pickupPoint, deliveryCoordinates || {});
      deliveryFee = quote.fee;
    }

    // eslint-disable-next-line no-await-in-loop
    const order = await Order.create({
      groupId,
      buyer: req.user._id,
      seller: sellerId,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      fulfillmentType,
      deliveryAddress: fulfillmentType === FULFILLMENT_TYPE.DELIVERY ? deliveryAddress : undefined,
      deliveryCoordinates: fulfillmentType === FULFILLMENT_TYPE.DELIVERY ? deliveryCoordinates : undefined,
      pickupNote: fulfillmentType === FULFILLMENT_TYPE.PICKUP ? pickupNote : undefined,
      buyerContact: buyerContact || req.user.phone,
      buyerNotes,
      paymentStatus: ORDER_PAYMENT_STATUS.PENDING,
      status: ORDER_STATUS.PLACED,
      statusHistory: [{ status: ORDER_STATUS.PLACED, by: req.user._id }],
    });
    createdOrders.push(order);

    if (fulfillmentType === FULFILLMENT_TYPE.DELIVERY) {
      // eslint-disable-next-line no-await-in-loop
      const delivery = await Delivery.create({
        order: order._id,
        seller: sellerId,
        buyer: req.user._id,
        pickup: { address: pickupPoint.address, lat: pickupPoint.lat, lng: pickupPoint.lng },
        dropoff: { address: deliveryAddress, lat: deliveryCoordinates?.lat, lng: deliveryCoordinates?.lng },
        zone: quote.zone,
        distanceKm: quote.distanceKm,
        fee: quote.fee,
        allowedVehicleTypes: quote.allowedVehicleTypes,
        estimatedDays: quote.estimatedDays,
      });
      order.delivery = delivery._id;
      // eslint-disable-next-line no-await-in-loop
      await order.save();
    }

    // eslint-disable-next-line no-await-in-loop
    await notify(sellerId, {
      type: 'order_placed',
      title: 'New order received',
      body: `An order worth UGX ${order.total.toLocaleString()} has been placed — awaiting payment confirmation.`,
      link: `/orders/${order._id}`,
      sms: true,
    });

    // Reserve stock immediately so it can't be oversold while this order is pending.
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      lines.map(async (line) => {
        const item = await MarketItem.findById(line.marketItem._id);
        item.quantity -= line.quantity;
        if (item.quantity <= 0) {
          item.quantity = 0;
          item.status = LISTING_STATUS.SOLD;
        }
        await item.save();
      })
    );
  }

  cart.items = [];
  await cart.save();

  // One payment covers every order created by this checkout (a single mobile
  // money prompt / card charge for the whole cart), split to sellers on success.
  const totalAmount = createdOrders.reduce((s, o) => s + o.total, 0);
  const provider = paymentMethod === PAYMENT_METHOD.CARD ? PAYMENT_PROVIDER.CARD_MOCK : paymentProvider;
  const { providerRef, message } = await getProvider(provider).initiate({ phoneNumber });

  const payment = await Payment.create({
    buyer: req.user._id,
    groupId,
    orders: createdOrders.map((o) => o._id),
    amount: totalAmount,
    method: paymentMethod,
    provider,
    phoneNumber: paymentMethod === PAYMENT_METHOD.MOBILE_MONEY ? phoneNumber : undefined,
    providerRef,
  });

  await Order.updateMany({ _id: { $in: createdOrders.map((o) => o._id) } }, { payment: payment._id });

  res.status(201).json({ success: true, data: createdOrders, payment: { ...payment.toObject(), message } });
});

// @desc  Orders placed by me (as a buyer)
// @route GET /api/orders/mine
const listMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id }).populate('seller', 'name phone').sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

// @desc  Orders received by me (as a seller)
// @route GET /api/orders/selling
const listOrdersForSeller = asyncHandler(async (req, res) => {
  const filter = { seller: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const orders = await Order.find(filter).populate('buyer', 'name phone').sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

// Handles both populated (full user doc, e.g. after .populate()) and
// unpopulated (raw ObjectId) buyer/seller fields.
const canView = (order, userId) =>
  String(order.buyer?._id || order.buyer) === String(userId) || String(order.seller?._id || order.seller) === String(userId);

// @desc  Get a single order (buyer or seller on it only)
// @route GET /api/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name phone')
    .populate('seller', 'name phone')
    .populate('payment')
    .populate({ path: 'delivery', populate: { path: 'courier', populate: { path: 'user', select: 'name phone' } } });
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (!canView(order, req.user._id)) {
    res.status(403);
    throw new Error('You cannot view this order.');
  }
  res.json({ success: true, data: order });
});

// @desc  Seller advances an order to the next status in its fulfillment flow.
//        For delivery orders, this only covers up to "packed" — from there,
//        a courier takes over via /api/deliveries.
// @route PUT /api/orders/:id/status
const advanceStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (String(order.seller) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Only the seller can update order status.');
  }
  if (ORDER_FINAL_STATUSES.includes(order.status)) {
    res.status(400);
    throw new Error('This order is already complete.');
  }
  if (order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID) {
    res.status(400);
    throw new Error('Payment has not been confirmed for this order yet.');
  }

  const flow = ORDER_STATUS_FLOW[order.fulfillmentType];
  const currentIndex = flow.indexOf(order.status);
  const requested = req.body.status;
  const requestedIndex = flow.indexOf(requested);

  if (requestedIndex === -1 || requestedIndex !== currentIndex + 1) {
    res.status(400);
    throw new Error(`Orders can only move forward one step at a time. Next valid status: ${flow[currentIndex + 1] || 'none'}.`);
  }

  if (order.fulfillmentType === FULFILLMENT_TYPE.DELIVERY && flow.indexOf('packed') < requestedIndex) {
    res.status(400);
    throw new Error('From here, a courier handles pickup and delivery — see the delivery status on this order.');
  }

  await applyOrderStatusChange(order, requested, req.user._id, req.body.note);

  res.json({ success: true, data: order });
});

// @desc  Cancel an order (buyer while early-stage, seller any time before completion)
// @route PUT /api/orders/:id/cancel
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  const isBuyer = String(order.buyer) === String(req.user._id);
  const isSeller = String(order.seller) === String(req.user._id);
  if (!isBuyer && !isSeller) {
    res.status(403);
    throw new Error('You cannot cancel this order.');
  }
  if (ORDER_FINAL_STATUSES.includes(order.status)) {
    res.status(400);
    throw new Error('This order can no longer be cancelled.');
  }
  if (isBuyer && !isSeller && ![ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(order.status)) {
    res.status(400);
    throw new Error('This order is already being prepared — please contact the seller to cancel it.');
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.cancelReason = req.body.reason || '';
  order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, by: req.user._id, note: req.body.reason });
  await order.save();
  await restockListing(order);
  await reversePendingForOrder(order);

  if (order.delivery) {
    const delivery = await Delivery.findByIdAndUpdate(
      order.delivery,
      {
        status: DELIVERY_STATUS.FAILED,
        failureReason: 'Order was cancelled.',
        $push: { statusHistory: { status: DELIVERY_STATUS.FAILED, note: 'Order was cancelled.' } },
      },
      { new: true }
    ).populate('courier');
    if (delivery?.courier) {
      await notify(delivery.courier.user, {
        type: 'delivery_cancelled',
        title: 'Delivery cancelled',
        body: `Order #${String(order._id).slice(-6).toUpperCase()} was cancelled — no need to continue with this delivery.`,
        link: '/courier',
      });
    }
    if (order.paymentStatus === ORDER_PAYMENT_STATUS.PAID || order.paymentStatus === ORDER_PAYMENT_STATUS.REFUNDED) {
      await refundDeliveryFeeToBuyer(order, delivery);
    }
  }

  const other = isBuyer ? order.seller : order.buyer;
  await notify(other, {
    type: 'order_cancelled',
    title: 'Order cancelled',
    body: `Order #${String(order._id).slice(-6).toUpperCase()} was cancelled${req.body.reason ? `: ${req.body.reason}` : '.'}`,
    link: `/orders/${order._id}`,
  });

  res.json({ success: true, data: order });
});

module.exports = {
  checkout, quoteDeliveryForCart, listMyOrders, listOrdersForSeller, getOrder, advanceStatus, cancelOrder,
};
