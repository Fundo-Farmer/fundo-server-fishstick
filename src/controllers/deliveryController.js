const asyncHandler = require('express-async-handler');
const Delivery = require('../models/Delivery');
const Courier = require('../models/Courier');
const Order = require('../models/Order');
const notify = require('../utils/notify');
const { applyOrderStatusChange } = require('../utils/orderFulfillment');
const { refundDeliveryFeeToBuyer } = require('../utils/walletService');
const { haversineKm } = require('../utils/geo');
const { getSettings } = require('../utils/settingsService');
const {
  DELIVERY_STATUS, DELIVERY_FLOW, COURIER_VERIFICATION_STATUS, ORDER_STATUS,
} = require('../config/constants');

const requireVerifiedCourier = async (userId) => {
  const courier = await Courier.findOne({ user: userId });
  if (!courier) {
    const err = new Error('You do not have a courier profile yet.');
    err.statusCode = 404;
    throw err;
  }
  if (courier.verification.status !== COURIER_VERIFICATION_STATUS.VERIFIED) {
    const err = new Error('Your courier account needs to be verified before you can take deliveries.');
    err.statusCode = 403;
    throw err;
  }
  return courier;
};

// @desc  Browse unassigned deliveries this courier's vehicle can take
// @route GET /api/deliveries/available
const listAvailable = asyncHandler(async (req, res) => {
  const courier = await requireVerifiedCourier(req.user._id);

  const deliveries = await Delivery.find({
    status: DELIVERY_STATUS.UNASSIGNED,
    allowedVehicleTypes: courier.vehicleType,
    previousCouriers: { $ne: courier._id },
  })
    .populate({ path: 'order', select: 'paymentStatus status' })
    .sort({ createdAt: 1 });

  // Only show deliveries whose order actually completed payment and hasn't
  // been cancelled — a Delivery is created at checkout, before payment clears.
  const payable = deliveries.filter((d) => d.order?.paymentStatus === 'paid' && d.order?.status !== 'cancelled');

  const withDistance = payable.map((d) => {
    const distanceFromMe =
      courier.baseLocation?.lat && d.pickup.lat
        ? Math.round(haversineKm(courier.baseLocation, { lat: d.pickup.lat, lng: d.pickup.lng }) * 10) / 10
        : null;
    return { ...d.toObject(), distanceFromMe };
  });

  res.json({ success: true, data: withDistance });
});

// @desc  Claim an unassigned delivery
// @route POST /api/deliveries/:id/claim
const claimDelivery = asyncHandler(async (req, res) => {
  const courier = await requireVerifiedCourier(req.user._id);

  const delivery = await Delivery.findById(req.params.id).populate({ path: 'order', select: 'paymentStatus status' });
  if (!delivery) {
    res.status(404);
    throw new Error('Delivery not found.');
  }
  if (delivery.status !== DELIVERY_STATUS.UNASSIGNED || delivery.courier) {
    res.status(400);
    throw new Error('This delivery has already been claimed.');
  }
  if (delivery.order?.paymentStatus !== 'paid' || delivery.order?.status === 'cancelled') {
    res.status(400);
    throw new Error('This order is not ready for delivery yet.');
  }
  if (!delivery.allowedVehicleTypes.includes(courier.vehicleType)) {
    res.status(400);
    throw new Error(`This delivery needs a ${delivery.allowedVehicleTypes.join(' or ')}.`);
  }
  if (delivery.previousCouriers.some((id) => String(id) === String(courier._id))) {
    res.status(400);
    throw new Error('You already reported a problem with this delivery — another courier needs to take it.');
  }

  delivery.courier = courier._id;
  delivery.status = DELIVERY_STATUS.ASSIGNED;
  delivery.assignedAt = new Date();
  delivery.statusHistory.push({ status: DELIVERY_STATUS.ASSIGNED });
  await delivery.save();

  await notify(delivery.buyer, {
    type: 'delivery_assigned',
    title: 'A courier is on the way',
    body: `${req.user.name} will handle delivery for order #${String(delivery.order).slice(-6).toUpperCase()}.`,
    link: `/orders/${delivery.order}`,
  });

  res.json({ success: true, data: delivery });
});

// @desc  Courier progresses a claimed delivery (picked_up → in_transit → delivered, or failed)
// @route PUT /api/deliveries/:id/status
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const delivery = await Delivery.findById(req.params.id);
  if (!delivery) {
    res.status(404);
    throw new Error('Delivery not found.');
  }
  const courier = await Courier.findOne({ user: req.user._id });
  if (!courier || String(delivery.courier) !== String(courier._id)) {
    res.status(403);
    throw new Error('You are not assigned to this delivery.');
  }

  const { status: requested, reason } = req.body;

  if ([DELIVERY_STATUS.FAILED, DELIVERY_STATUS.DELIVERED].includes(delivery.status)) {
    res.status(400);
    throw new Error('This delivery is already complete.');
  }

  if (requested === DELIVERY_STATUS.FAILED) {
    const order = await Order.findById(delivery.order);
    const wasPickedUp = [DELIVERY_STATUS.PICKED_UP, DELIVERY_STATUS.IN_TRANSIT].includes(delivery.status);
    const settings = await getSettings();
    const canReassign = !wasPickedUp && delivery.reassignmentCount < settings.maxDeliveryReassignments;

    delivery.failureReason = reason || '';
    delivery.previousCouriers.push(courier._id);
    delivery.statusHistory.push({ status: DELIVERY_STATUS.FAILED, note: reason });

    if (canReassign) {
      // Goods hadn't been picked up yet — reopen the job for a different
      // courier rather than giving up on the delivery entirely.
      delivery.reassignmentCount += 1;
      delivery.courier = null;
      delivery.assignedAt = undefined;
      delivery.status = DELIVERY_STATUS.UNASSIGNED;
      delivery.statusHistory.push({ status: DELIVERY_STATUS.UNASSIGNED, note: 'Reopened for another courier' });
      await delivery.save();

      await notify(delivery.seller, {
        type: 'delivery_reassigning',
        title: 'Looking for another courier',
        body: reason ? `The previous courier reported: ${reason}` : 'The previous courier reported a problem — we are finding a new one.',
        link: `/orders/${delivery.order}`,
      });
    } else {
      // Either the goods were already with the courier, or we've tried
      // enough couriers — this delivery is done. Refund the delivery fee
      // rather than leaving it unaccounted for.
      delivery.status = DELIVERY_STATUS.FAILED;
      await delivery.save();
      await refundDeliveryFeeToBuyer(order, delivery);

      await notify(delivery.seller, {
        type: 'delivery_failed',
        title: 'Delivery could not be completed',
        body: `${reason ? `${reason} — ` : ''}The delivery fee has been refunded to the buyer. You may need to arrange delivery another way.`,
        link: `/orders/${delivery.order}`,
      });
    }

    return res.json({ success: true, data: delivery });
  }

  if (requested === DELIVERY_STATUS.UNASSIGNED) {
    res.status(400);
    throw new Error('Invalid status.');
  }

  const currentIndex = DELIVERY_FLOW.indexOf(delivery.status);
  const requestedIndex = DELIVERY_FLOW.indexOf(requested);
  if (requestedIndex === -1 || requestedIndex !== currentIndex + 1) {
    res.status(400);
    throw new Error(`Deliveries move forward one step at a time. Next valid status: ${DELIVERY_FLOW[currentIndex + 1] || 'none'}.`);
  }

  const order = await Order.findById(delivery.order);
  if (requested === DELIVERY_STATUS.PICKED_UP && order.status !== ORDER_STATUS.PACKED) {
    res.status(400);
    throw new Error("The seller hasn't marked this order as packed yet.");
  }

  delivery.status = requested;
  delivery.statusHistory.push({ status: requested });
  if (requested === DELIVERY_STATUS.PICKED_UP) delivery.pickedUpAt = new Date();
  if (requested === DELIVERY_STATUS.DELIVERED) delivery.deliveredAt = new Date();
  await delivery.save();

  if (requested === DELIVERY_STATUS.PICKED_UP) {
    await applyOrderStatusChange(order, ORDER_STATUS.OUT_FOR_DELIVERY, req.user._id, 'Picked up by courier');
  } else if (requested === DELIVERY_STATUS.DELIVERED) {
    await applyOrderStatusChange(order, ORDER_STATUS.DELIVERED, req.user._id, 'Delivered by courier');
    courier.completedDeliveries += 1;
    await courier.save();
  }

  res.json({ success: true, data: delivery });
});

// @desc  My active + past deliveries
// @route GET /api/deliveries/mine
const myDeliveries = asyncHandler(async (req, res) => {
  const courier = await Courier.findOne({ user: req.user._id });
  if (!courier) return res.json({ success: true, data: [] });
  const deliveries = await Delivery.find({ courier: courier._id })
    .populate('buyer', 'name phone')
    .populate('seller', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: deliveries });
});

module.exports = { listAvailable, claimDelivery, updateDeliveryStatus, myDeliveries };
