const { syncFarmRecordsOnFulfilled } = require('./inventorySync');
const { releaseEscrowForOrder, creditCourierForDelivery } = require('./walletService');
const notify = require('./notify');
const { ORDER_FINAL_STATUSES } = require('../config/constants');

/**
 * Call whenever an order's status changes to `newStatus` — handles the
 * shared side-effects (escrow release + farm-record sync on final success,
 * courier payout for delivery orders, buyer notification) regardless of
 * which flow (seller pickup handoff, or courier delivery) drove the transition.
 */
const applyOrderStatusChange = async (order, newStatus, actorId, note) => {
  order.status = newStatus;
  order.statusHistory.push({ status: newStatus, by: actorId, note });
  await order.save();

  if (ORDER_FINAL_STATUSES.includes(newStatus) && newStatus !== 'cancelled') {
    await syncFarmRecordsOnFulfilled(order);
    await releaseEscrowForOrder(order);
  }
  if (newStatus === 'delivered') {
    await creditCourierForDelivery(order);
  }

  await notify(order.buyer, {
    type: 'order_status_changed',
    title: `Order update: ${newStatus.replace(/_/g, ' ')}`,
    body: `Your order #${String(order._id).slice(-6).toUpperCase()} is now "${newStatus.replace(/_/g, ' ')}".`,
    link: `/orders/${order._id}`,
    sms: newStatus === 'delivered' || newStatus === 'picked_up',
  });
};

module.exports = { applyOrderStatusChange };
