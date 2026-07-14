const PreOrder = require('../models/PreOrder');
const HarvestForecast = require('../models/HarvestForecast');
const PlatformRevenue = require('../models/PlatformRevenue');
const { getOrCreateWallet, logTxn, round2 } = require('./walletService');
const { getCommissionPercentForSeller } = require('./commissionRate');
const notify = require('./notify');
const { PAYMENT_STATUS, PREORDER_STATUS, HARVEST_FORECAST_STATUS, WALLET_TXN_TYPE, PLATFORM_REVENUE_TYPE } = require('../config/constants');

/**
 * Payment succeeded for a pre-order: take the platform commission, hold the
 * seller's share in escrow until the forecast is actually fulfilled. Mirrors
 * walletService.creditPendingForOrder, just against a PreOrder instead of an Order.
 */
const creditPendingForPreOrder = async (preOrder) => {
  const commissionPercent = await getCommissionPercentForSeller(preOrder.seller);
  const commissionAmount = round2(preOrder.total * (commissionPercent / 100));
  const sellerAmount = round2(preOrder.total - commissionAmount);

  preOrder.paymentStatus = PAYMENT_STATUS.SUCCESSFUL;
  preOrder.status = PREORDER_STATUS.CONFIRMED;
  preOrder.commissionAmount = commissionAmount;
  preOrder.sellerAmount = sellerAmount;
  await preOrder.save();

  const wallet = await getOrCreateWallet(preOrder.seller);
  wallet.balancePending = round2(wallet.balancePending + sellerAmount);
  wallet.totalEarned = round2(wallet.totalEarned + sellerAmount);
  await wallet.save();

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.CREDIT_PENDING,
    amount: sellerAmount,
    description: `Pre-order payment received (held in escrow until harvest)`,
  });

  if (commissionAmount > 0) {
    const forecast = await HarvestForecast.findById(preOrder.forecast).select('farm');
    await PlatformRevenue.create({
      type: PLATFORM_REVENUE_TYPE.COMMISSION,
      amount: commissionAmount,
      farm: forecast?.farm || null,
      preOrder: preOrder._id,
      description: `Commission on harvest pre-order`,
    });
  }

  await notify(preOrder.seller, {
    type: 'preorder_paid',
    title: 'Pre-order confirmed',
    body: `A pre-order worth UGX ${preOrder.total.toLocaleString()} is confirmed and held in escrow until the harvest.`,
    link: '/dashboard/preorders',
    sms: true,
  });
  await notify(preOrder.buyer, {
    type: 'preorder_confirmed',
    title: 'Pre-order confirmed',
    body: `Your pre-order is confirmed. You'll be notified when the harvest is ready.`,
    link: '/preorders/mine',
    sms: true,
  });
};

/**
 * The harvest forecast this pre-order belongs to was fulfilled: release the
 * seller's escrowed share to their available balance.
 */
const releaseEscrowForPreOrder = async (preOrder) => {
  if (preOrder.status !== PREORDER_STATUS.CONFIRMED || preOrder.escrowReleased) return;

  const wallet = await getOrCreateWallet(preOrder.seller);
  wallet.balancePending = round2(wallet.balancePending - preOrder.sellerAmount);
  wallet.balanceAvailable = round2(wallet.balanceAvailable + preOrder.sellerAmount);
  await wallet.save();

  preOrder.escrowReleased = true;
  preOrder.status = PREORDER_STATUS.FULFILLED;
  await preOrder.save();

  await logTxn(wallet, {
    type: WALLET_TXN_TYPE.RELEASE,
    amount: preOrder.sellerAmount,
    description: `Pre-order escrow released — harvest fulfilled`,
  });

  await notify(preOrder.seller, {
    type: 'escrow_released',
    title: 'Pre-order funds released',
    body: `UGX ${preOrder.sellerAmount.toLocaleString()} from a fulfilled pre-order is now available to withdraw.`,
    link: '/wallet',
    sms: true,
  });
};

/**
 * A confirmed (paid) pre-order is cancelled before the harvest — reverse the
 * seller's escrow hold and refund the buyer in full, the same honest pattern
 * used for order/delivery-fee refunds elsewhere in the app.
 */
const reverseAndRefundPreOrder = async (preOrder) => {
  if (preOrder.paymentStatus !== PAYMENT_STATUS.SUCCESSFUL) return;

  if (!preOrder.escrowReleased) {
    const sellerWallet = await getOrCreateWallet(preOrder.seller);
    sellerWallet.balancePending = round2(sellerWallet.balancePending - preOrder.sellerAmount);
    await sellerWallet.save();
    await logTxn(sellerWallet, {
      type: WALLET_TXN_TYPE.REVERSE_PENDING,
      amount: -preOrder.sellerAmount,
      description: `Pre-order escrow hold reversed — cancelled before harvest`,
    });
  }

  const buyerWallet = await getOrCreateWallet(preOrder.buyer);
  buyerWallet.balanceAvailable = round2(buyerWallet.balanceAvailable + preOrder.total);
  await buyerWallet.save();
  await logTxn(buyerWallet, {
    type: WALLET_TXN_TYPE.ORDER_REFUND,
    amount: preOrder.total,
    description: `Pre-order refund — cancelled`,
  });

  // The quantity was reserved against the forecast back when this pre-order
  // was created — free it up now that it's cancelled, so someone else can
  // pre-order it.
  await HarvestForecast.findByIdAndUpdate(preOrder.forecast, { $inc: { quantityReserved: -preOrder.quantity } });

  preOrder.paymentStatus = PAYMENT_STATUS.REFUNDED;
  await preOrder.save();

  await notify(preOrder.buyer, {
    type: 'preorder_refunded',
    title: 'Pre-order refunded',
    body: `UGX ${preOrder.total.toLocaleString()} has been credited to your Fundo wallet.`,
    link: '/wallet',
    sms: true,
  });
};

/**
 * Shared entrypoint for the payment providers (mock or real) to report a
 * pre-order payment's outcome — passed as `onResolve` to `provider.initiate()`,
 * the same pattern as walletService.handlePaymentCallback for Order payments.
 */
const handlePreOrderPaymentCallback = async (providerRef, outcome, failureReason) => {
  const preOrder = await PreOrder.findOne({ providerRef });
  if (!preOrder || preOrder.paymentStatus !== PAYMENT_STATUS.PENDING) return;

  // Buyer cancelled while payment was still in flight — refund in full
  // rather than crediting the seller for an order that's already off.
  if (preOrder.status === PREORDER_STATUS.CANCELLED) {
    if (outcome === PAYMENT_STATUS.SUCCESSFUL) {
      preOrder.paymentStatus = PAYMENT_STATUS.SUCCESSFUL;
      await preOrder.save();
      const buyerWallet = await getOrCreateWallet(preOrder.buyer);
      buyerWallet.balanceAvailable = round2(buyerWallet.balanceAvailable + preOrder.total);
      await buyerWallet.save();
      await logTxn(buyerWallet, {
        type: WALLET_TXN_TYPE.ORDER_REFUND,
        amount: preOrder.total,
        description: `Refund — payment arrived for an already-cancelled pre-order`,
      });
      await notify(preOrder.buyer, {
        type: 'preorder_refunded',
        title: 'Pre-order refunded',
        body: `UGX ${preOrder.total.toLocaleString()} has been credited to your Fundo wallet.`,
        link: '/wallet',
        sms: true,
      });
    }
    return;
  }

  if (outcome === PAYMENT_STATUS.SUCCESSFUL) {
    await creditPendingForPreOrder(preOrder);

    // If the harvest was already marked fulfilled before this (late-arriving)
    // payment resolved, there's no future "fulfill" sweep left to release this
    // pre-order's escrow — release it immediately instead of leaving it stuck
    // in the seller's pending balance forever.
    const forecast = await HarvestForecast.findById(preOrder.forecast);
    if (forecast && forecast.status === HARVEST_FORECAST_STATUS.COMPLETED) {
      await releaseEscrowForPreOrder(preOrder);
    }
  } else {
    preOrder.paymentStatus = PAYMENT_STATUS.FAILED;
    preOrder.failureReason = failureReason || 'Payment was not completed.';
    await preOrder.save();
    await notify(preOrder.buyer, {
      type: 'preorder_payment_failed',
      title: 'Pre-order payment failed',
      body: preOrder.failureReason,
      link: '/preorders/mine',
      sms: true,
    });
    // Release the reserved quantity back to the forecast so someone else can claim it.
    await HarvestForecast.findByIdAndUpdate(preOrder.forecast, { $inc: { quantityReserved: -preOrder.quantity } });
  }
};

module.exports = {
  creditPendingForPreOrder,
  releaseEscrowForPreOrder,
  reverseAndRefundPreOrder,
  handlePreOrderPaymentCallback,
};
