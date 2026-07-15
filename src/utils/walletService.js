const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const Courier = require('../models/Courier');
const User = require('../models/User');
const PlatformRevenue = require('../models/PlatformRevenue');
const notify = require('./notify');
const { getCommissionPercentForSeller } = require('./commissionRate');
const { getSettings } = require('./settingsService');
const { ORDER_PAYMENT_STATUS, PAYMENT_STATUS, WALLET_TXN_TYPE, PLATFORM_REVENUE_TYPE } = require('../config/constants');

const round2 = (n) => Math.round(n * 100) / 100;

const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) wallet = await Wallet.create({ user: userId });
  return wallet;
};

const logTxn = (wallet, fields) =>
  WalletTransaction.create({
    wallet: wallet._id,
    user: wallet.user,
    balanceAvailableAfter: wallet.balanceAvailable,
    balancePendingAfter: wallet.balancePending,
    ...fields,
  });

/**
 * Payment succeeded for one order: take the platform commission, and hold the
 * seller's share in escrow (wallet.balancePending) until the order is fulfilled.
 *
 * The commission rate itself isn't flat — a seller whose farm is on the
 * Premium plan pays less (see utils/commissionRate.js). Commission and the
 * seller's share are computed from `order.subtotal` (the
 * goods only) — NOT `order.total`, which for delivery orders also includes the
 * delivery fee. That fee belongs to whichever courier completes the delivery,
 * not the seller — see `creditCourierForDelivery` below.
 */
const creditPendingForOrder = async (order) => {
  const commissionPercent = await getCommissionPercentForSeller(order.seller);
  const commissionAmount = round2(order.subtotal * (commissionPercent / 100));
  const sellerAmount = round2(order.subtotal - commissionAmount);

  order.paymentStatus = ORDER_PAYMENT_STATUS.PAID;
  order.commissionAmount = commissionAmount;
  order.sellerAmount = sellerAmount;
  await order.save();

  const wallet = await getOrCreateWallet(order.seller);
  wallet.balancePending = round2(wallet.balancePending + sellerAmount);
  wallet.totalEarned = round2(wallet.totalEarned + sellerAmount);
  await wallet.save();

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.CREDIT_PENDING,
    amount: sellerAmount,
    order: order._id,
    payment: order.payment,
    description: `Payment received for order #${String(order._id).slice(-6).toUpperCase()} (held in escrow)`,
  });

  if (commissionAmount > 0) {
    const seller = await User.findById(order.seller).select('farm');
    await PlatformRevenue.create({
      type: PLATFORM_REVENUE_TYPE.COMMISSION,
      amount: commissionAmount,
      farm: seller?.farm || null,
      order: order._id,
      description: `Commission on order #${String(order._id).slice(-6).toUpperCase()}`,
    });
  }
};

/**
 * Order reached a final, successful fulfillment status: release the escrowed
 * amount into the seller's available (withdrawable) balance.
 */
const releaseEscrowForOrder = async (order) => {
  if (order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID || order.escrowReleased) return;

  const wallet = await getOrCreateWallet(order.seller);
  wallet.balancePending = round2(wallet.balancePending - order.sellerAmount);
  wallet.balanceAvailable = round2(wallet.balanceAvailable + order.sellerAmount);
  await wallet.save();

  order.escrowReleased = true;
  await order.save();

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.RELEASE,
    amount: order.sellerAmount,
    order: order._id,
    payment: order.payment,
    description: `Escrow released for order #${String(order._id).slice(-6).toUpperCase()}`,
  });

  await notify(order.seller, {
    type: 'escrow_released',
    title: 'Funds released to your wallet',
    body: `UGX ${order.sellerAmount.toLocaleString()} from order #${String(order._id).slice(-6).toUpperCase()} is now available to withdraw.`,
    link: '/wallet',
    sms: true,
  });
};

/**
 * A delivery was completed: pay the courier who did it out of the order's
 * delivery fee (same commission rate as everything else), straight to their
 * available balance — there's no separate "pending" phase here, since the
 * courier's own action of marking it delivered is what triggers the payout in
 * the first place, unlike the seller's escrow, which needs an independent
 * "did this actually arrive" signal.
 */
const creditCourierForDelivery = async (order) => {
  if (!order.delivery) return;
  const delivery = await Delivery.findById(order.delivery);
  if (!delivery || !delivery.courier || !delivery.fee) return;

  const courier = await Courier.findById(delivery.courier);
  if (!courier) return;

  const settings = await getSettings();
  const commissionAmount = round2(delivery.fee * (settings.platformCommissionPercent / 100));
  const courierAmount = round2(delivery.fee - commissionAmount);

  const wallet = await getOrCreateWallet(courier.user);
  wallet.balanceAvailable = round2(wallet.balanceAvailable + courierAmount);
  wallet.totalEarned = round2(wallet.totalEarned + courierAmount);
  await wallet.save();

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.RELEASE,
    amount: courierAmount,
    order: order._id,
    description: `Delivery fee for order #${String(order._id).slice(-6).toUpperCase()}`,
  });

  await notify(courier.user, {
    type: 'delivery_paid',
    title: 'Delivery fee paid',
    body: `UGX ${courierAmount.toLocaleString()} for order #${String(order._id).slice(-6).toUpperCase()} is now available in your wallet.`,
    link: '/wallet',
    sms: true,
  });

  if (commissionAmount > 0) {
    await PlatformRevenue.create({
      type: PLATFORM_REVENUE_TYPE.COMMISSION,
      amount: commissionAmount,
      order: order._id,
      description: `Commission on delivery fee for order #${String(order._id).slice(-6).toUpperCase()}`,
    });
  }
};

/**
 * Order was cancelled after payment succeeded but before fulfillment: remove the
 * escrow hold. (If escrow had already been released — funds already withdrawable
 * or withdrawn — this only flags the order; reconciling already-paid-out funds is
 * a manual admin action, same as any real payment processor would require.)
 */
const reversePendingForOrder = async (order) => {
  if (order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID) return;

  if (!order.escrowReleased) {
    const sellerWallet = await getOrCreateWallet(order.seller);
    sellerWallet.balancePending = round2(sellerWallet.balancePending - order.sellerAmount);
    await sellerWallet.save();

    await logTxn(sellerWallet, {
      type: WALLET_TXN_TYPE.REVERSE_PENDING,
      amount: -order.sellerAmount,
      order: order._id,
      payment: order.payment,
      description: `Escrow hold reversed — order #${String(order._id).slice(-6).toUpperCase()} cancelled`,
    });

    // The buyer paid `subtotal` for the goods (separate from any delivery
    // fee, which has its own refund path — see refundDeliveryFeeToBuyer).
    // Removing the seller's hold above isn't the same as the buyer actually
    // getting their money back — credit it to their wallet directly.
    const buyerWallet = await getOrCreateWallet(order.buyer);
    buyerWallet.balanceAvailable = round2(buyerWallet.balanceAvailable + order.subtotal);
    await buyerWallet.save();

    await logTxn(buyerWallet, {
      type: WALLET_TXN_TYPE.ORDER_REFUND,
      amount: order.subtotal,
      order: order._id,
      payment: order.payment,
      description: `Refund for cancelled order #${String(order._id).slice(-6).toUpperCase()}`,
    });
  }

  order.paymentStatus = ORDER_PAYMENT_STATUS.REFUNDED;
  await order.save();

  await notify(order.buyer, {
    type: 'order_refunded',
    title: 'Refund credited to your wallet',
    body: `UGX ${order.subtotal.toLocaleString()} for order #${String(order._id).slice(-6).toUpperCase()} has been credited to your Fundo wallet.`,
    link: '/wallet',
    sms: true,
  });
};

/**
 * Shared entrypoint for both the mock provider and (eventually) a real payment
 * provider's webhook: resolves a Payment by its provider reference and applies
 * the outcome to every order it covers.
 */
const handlePaymentCallback = async (providerRef, outcome, failureReason) => {
  const payment = await Payment.findOne({ providerRef }).populate('orders');
  if (!payment || payment.status !== PAYMENT_STATUS.PENDING) return;

  if (outcome === PAYMENT_STATUS.SUCCESSFUL) {
    payment.status = PAYMENT_STATUS.SUCCESSFUL;
    payment.paidAt = new Date();
    await payment.save();

    for (const order of payment.orders) {
      // If the buyer cancelled while payment was still in flight, the money
      // shouldn't be credited to the seller — refund it to the buyer instead
      // of just labeling the order "refunded" without actually moving anything.
      if (order.status === 'cancelled') {
        const buyerWallet = await getOrCreateWallet(order.buyer);
        buyerWallet.balanceAvailable = round2(buyerWallet.balanceAvailable + order.total);
        // eslint-disable-next-line no-await-in-loop
        await buyerWallet.save();
        // eslint-disable-next-line no-await-in-loop
        await logTxn(buyerWallet, {
          type: WALLET_TXN_TYPE.ORDER_REFUND,
          amount: order.total,
          order: order._id,
          payment: payment._id,
          description: `Refund — payment arrived for already-cancelled order #${String(order._id).slice(-6).toUpperCase()}`,
        });

        order.paymentStatus = 'refunded';
        // eslint-disable-next-line no-await-in-loop
        await order.save();
        // eslint-disable-next-line no-await-in-loop
        await notify(payment.buyer, {
          type: 'order_refunded',
          title: 'Refund credited to your wallet',
          body: `UGX ${order.total.toLocaleString()} for cancelled order #${String(order._id).slice(-6).toUpperCase()} has been credited to your Fundo wallet.`,
          link: '/wallet',
          sms: true,
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await creditPendingForOrder(order);
    }

    await notify(payment.buyer, {
      type: 'payment_confirmed',
      title: 'Payment confirmed',
      body: `Your payment of UGX ${payment.amount.toLocaleString()} was successful.`,
      link: '/orders',
      sms: true,
    });
    for (const order of payment.orders) {
      if (order.status === 'cancelled') continue;
      // eslint-disable-next-line no-await-in-loop
      await notify(order.seller, {
        type: 'payment_received',
        title: 'New paid order',
        body: `You have a new paid order worth UGX ${order.total.toLocaleString()}, held in escrow until fulfilled.`,
        link: `/orders/${order._id}`,
      });
    }
  } else {
    payment.status = PAYMENT_STATUS.FAILED;
    payment.failureReason = failureReason || 'Payment was not completed.';
    await payment.save();

    await notify(payment.buyer, {
      type: 'payment_failed',
      title: 'Payment failed',
      body: payment.failureReason,
      link: '/orders',
      sms: true,
    });
  }
};

const requestWithdrawal = async (WithdrawalRequest, user, { amount, method, destination }) => {
  const wallet = await getOrCreateWallet(user._id);
  if (amount <= 0 || amount > wallet.balanceAvailable) {
    const err = new Error('Withdrawal amount exceeds your available balance.');
    err.statusCode = 400;
    throw err;
  }

  wallet.balanceAvailable = round2(wallet.balanceAvailable - amount);
  wallet.balanceLocked = round2(wallet.balanceLocked + amount);
  await wallet.save();

  const withdrawal = await WithdrawalRequest.create({ user: user._id, amount, method, destination });

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.WITHDRAWAL_LOCK,
    amount: -amount,
    withdrawal: withdrawal._id,
    description: `Withdrawal requested to ${destination}`,
  });

  return withdrawal;
};

const resolveWithdrawal = async (withdrawal, approve, adminId, note) => {
  const wallet = await getOrCreateWallet(withdrawal.user);

  if (approve) {
    wallet.balanceLocked = round2(wallet.balanceLocked - withdrawal.amount);
    wallet.totalWithdrawn = round2(wallet.totalWithdrawn + withdrawal.amount);
    await wallet.save();
    withdrawal.status = 'completed';
    await logTxn(wallet, {
      type: WALLET_TXN_TYPE.WITHDRAWAL_COMPLETE,
      amount: -withdrawal.amount,
      withdrawal: withdrawal._id,
      description: `Withdrawal paid out to ${withdrawal.destination}`,
    });
  } else {
    wallet.balanceLocked = round2(wallet.balanceLocked - withdrawal.amount);
    wallet.balanceAvailable = round2(wallet.balanceAvailable + withdrawal.amount);
    await wallet.save();
    withdrawal.status = 'rejected';
    await logTxn(wallet, {
      type: WALLET_TXN_TYPE.WITHDRAWAL_REJECTED,
      amount: withdrawal.amount,
      withdrawal: withdrawal._id,
      description: `Withdrawal rejected — funds returned to available balance`,
    });
  }

  withdrawal.processedBy = adminId;
  withdrawal.processedAt = new Date();
  withdrawal.note = note;
  await withdrawal.save();

  await notify(withdrawal.user, {
    type: approve ? 'withdrawal_completed' : 'withdrawal_rejected',
    title: approve ? 'Withdrawal completed' : 'Withdrawal rejected',
    body: approve
      ? `UGX ${withdrawal.amount.toLocaleString()} has been sent to ${withdrawal.destination}.`
      : `Your withdrawal request was rejected${note ? `: ${note}` : '.'}`,
    link: '/wallet',
  });

  return withdrawal;
};

/**
 * A delivery permanently failed (either it failed after the courier already
 * had the goods, or it exhausted its reassignment attempts before pickup):
 * refund the delivery-fee portion of the payment to the buyer's own wallet as
 * credit. There's no real payment gateway here to reverse a mobile-money
 * charge (see README "Payments architecture"), so a wallet credit — usable
 * toward a future order, or withdrawable like any other balance — is the
 * honest equivalent, the same way many real platforms handle refunds when an
 * instant reversal isn't available.
 */
const refundDeliveryFeeToBuyer = async (order, delivery) => {
  if (delivery.feeRefunded || !delivery.fee) return;

  const wallet = await getOrCreateWallet(order.buyer);
  wallet.balanceAvailable = round2(wallet.balanceAvailable + delivery.fee);
  await wallet.save();

  delivery.feeRefunded = true;
  await delivery.save();

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.DELIVERY_REFUND,
    amount: delivery.fee,
    order: order._id,
    description: `Delivery fee refunded — order #${String(order._id).slice(-6).toUpperCase()} couldn't be delivered`,
  });

  await notify(order.buyer, {
    type: 'delivery_fee_refunded',
    title: 'Delivery fee refunded',
    body: `UGX ${delivery.fee.toLocaleString()} has been credited to your Fundo wallet since order #${String(order._id).slice(-6).toUpperCase()} couldn't be delivered.`,
    link: '/wallet',
    sms: true,
  });
};
module.exports = {
  getOrCreateWallet,
  logTxn,
  round2,
  creditPendingForOrder,
  releaseEscrowForOrder,
  creditCourierForDelivery,
  refundDeliveryFeeToBuyer,
  reversePendingForOrder,
  handlePaymentCallback,
  requestWithdrawal,
  resolveWithdrawal,
};
