module.exports = {
  ROLES: {
    SUPER_ADMIN: 'super_admin',   // Fundo platform admin
    FARM_ADMIN: 'farm_admin',     // Owns/manages a farm
    WORKER: 'worker',             // Works on a farm, limited access
    CUSTOMER: 'customer',         // Shop/auction buyer & seller, public-facing
  },
  MODULES: {
    LIVESTOCK: 'livestock',
    COFFEE: 'coffee',
    PETS: 'pets',
    PLANTATION: 'plantation',
  },
  LISTING_STATUS: {
    AVAILABLE: 'available',
    RESERVED: 'reserved',
    SOLD: 'sold',
    REMOVED: 'removed',
  },
  AUCTION_STATUS: {
    SCHEDULED: 'scheduled',
    LIVE: 'live',
    ENDED: 'ended',
    CANCELLED: 'cancelled',
  },
  FULFILLMENT_TYPE: {
    DELIVERY: 'delivery',
    PICKUP: 'pickup',
  },
  ORDER_STATUS: {
    PLACED: 'placed',
    CONFIRMED: 'confirmed',
    PACKED: 'packed',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    READY_FOR_PICKUP: 'ready_for_pickup',
    PICKED_UP: 'picked_up',
    CANCELLED: 'cancelled',
  },
  // Which statuses are considered "final" for an order (no further transitions)
  ORDER_FINAL_STATUSES: ['delivered', 'picked_up', 'cancelled'],
  // Final AND successful (excludes cancelled) — the only statuses eligible for review
  FINAL_SUCCESS_STATUSES: ['delivered', 'picked_up'],
  // Valid forward transitions per fulfillment type. Cancellation is handled separately.
  ORDER_STATUS_FLOW: {
    delivery: ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'],
    pickup: ['placed', 'confirmed', 'ready_for_pickup', 'picked_up'],
  },
  SOURCE_TYPES: ['Livestock', 'Pet', 'CoffeeGarden', 'Plantation', null],

  PAYMENT_METHOD: {
    MOBILE_MONEY: 'mobile_money',
    CARD: 'card',
  },
  PAYMENT_PROVIDER: {
    MTN: 'mtn',
    AIRTEL: 'airtel',
    CARD_MOCK: 'card_mock',
  },
  PAYMENT_STATUS: {
    PENDING: 'pending',
    SUCCESSFUL: 'successful',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },
  ORDER_PAYMENT_STATUS: {
    UNPAID: 'unpaid',
    PENDING: 'pending',
    PAID: 'paid',
    REFUNDED: 'refunded',
  },
  WALLET_TXN_TYPE: {
    CREDIT_PENDING: 'credit_pending', // payment received, held in escrow
    RELEASE: 'release',               // escrow released to available balance
    REVERSE_PENDING: 'reverse_pending', // order cancelled before release
    WITHDRAWAL_LOCK: 'withdrawal_lock', // funds earmarked for a withdrawal request
    WITHDRAWAL_COMPLETE: 'withdrawal_complete',
    WITHDRAWAL_REJECTED: 'withdrawal_rejected', // funds returned to available
    DELIVERY_REFUND: 'delivery_refund', // delivery permanently failed — fee refunded to the buyer
    ORDER_REFUND: 'order_refund', // order cancelled after payment — goods portion refunded to the buyer
  },
  WITHDRAWAL_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
  },
  // Platform commission taken on each successful payment, before crediting the seller's wallet
  PLATFORM_COMMISSION_PERCENT: Number(process.env.PLATFORM_COMMISSION_PERCENT || 6),

  FARM_VERIFICATION_STATUS: {
    UNVERIFIED: 'unverified', // never submitted
    PENDING: 'pending',       // submitted, awaiting admin review
    VERIFIED: 'verified',
    REJECTED: 'rejected',
  },
  // Orders eligible for a review — only genuinely completed sales, not cancellations
  ORDER_REVIEWABLE_STATUSES: ['delivered', 'picked_up'],
  REVIEW_DIRECTION: {
    BUYER_TO_SELLER: 'buyer_to_seller',
    SELLER_TO_BUYER: 'seller_to_buyer',
  },
  // Common self-declared quality/certification tags a seller can attach to a listing.
  // Unlike farm verification (admin-reviewed), these are NOT independently verified —
  // the UI must label them as seller-declared.
  CERTIFICATION_TAGS: [
    'organic', 'free_range', 'grass_fed', 'disease_free', 'unbs_certified',
    'quality_graded', 'hand_picked', 'freshly_harvested',
  ],

  // --- Logistics (Phase 5) ---
  VEHICLE_TYPES: ['bicycle', 'motorcycle', 'tuktuk', 'truck'],

  COURIER_VERIFICATION_STATUS: {
    UNVERIFIED: 'unverified',
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
  },

  DELIVERY_ZONE: {
    LOCAL: 'local',
    LONG_HAUL: 'long_haul',
    UNKNOWN: 'unknown', // distance couldn't be computed (missing coordinates on either end)
  },

  // Which vehicle types can legitimately serve each zone — a bicycle can't
  // reasonably do a 200km trip, so long-haul is restricted to motorised options.
  ZONE_ALLOWED_VEHICLES: {
    local: ['bicycle', 'motorcycle', 'tuktuk', 'truck'],
    long_haul: ['motorcycle', 'truck'],
    unknown: ['bicycle', 'motorcycle', 'tuktuk', 'truck'],
  },

  DELIVERY_STATUS: {
    UNASSIGNED: 'unassigned',
    ASSIGNED: 'assigned',
    PICKED_UP: 'picked_up',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    FAILED: 'failed',
  },
  DELIVERY_FLOW: ['unassigned', 'assigned', 'picked_up', 'in_transit', 'delivered'],
  // A pre-pickup failure gets reopened for another courier this many times
  // before we give up and refund the delivery fee instead.
  MAX_DELIVERY_REASSIGNMENTS: Number(process.env.MAX_DELIVERY_REASSIGNMENTS || 3),

  // Fee model — deliberately simple tiers rather than a real distance-pricing
  // API (see README "Logistics" section for how this is meant to be tuned/replaced).
  DELIVERY_PRICING: {
    LOCAL_RADIUS_KM: Number(process.env.LOCAL_DELIVERY_RADIUS_KM || 15),
    LOCAL_BASE_FEE: Number(process.env.LOCAL_DELIVERY_BASE_FEE || 2000),
    LOCAL_FEE_PER_KM: Number(process.env.LOCAL_DELIVERY_FEE_PER_KM || 500),
    LONG_HAUL_BASE_FEE: Number(process.env.LONG_HAUL_DELIVERY_BASE_FEE || 15000),
    LONG_HAUL_FEE_PER_KM: Number(process.env.LONG_HAUL_DELIVERY_FEE_PER_KM || 800),
    // Used when we can't compute a distance at all (no coordinates on one end)
    FALLBACK_FLAT_FEE: Number(process.env.DELIVERY_FALLBACK_FEE || 5000),
    // Rough transit estimate for long-haul, shown to the buyer as a range
    LONG_HAUL_KM_PER_DAY: Number(process.env.LONG_HAUL_KM_PER_DAY || 400),
  },

  // --- Retention (Phase 6) ---
  SUBSCRIPTION_FREQUENCY: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    BIWEEKLY: 'biweekly',
    MONTHLY: 'monthly',
  },
  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active',
    PAUSED: 'paused',
    CANCELLED: 'cancelled',
  },
  PREORDER_STATUS: {
    AWAITING_PAYMENT: 'awaiting_payment',
    CONFIRMED: 'confirmed',   // paid, waiting for the harvest
    FULFILLED: 'fulfilled',
    CANCELLED: 'cancelled',
  },
  HARVEST_FORECAST_STATUS: {
    OPEN: 'open',           // still taking pre-orders
    FULFILLING: 'fulfilling', // harvest happened, converting pre-orders to orders
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  // A subscription auto-pauses after this many cycles in a row are skipped
  // (e.g. the listing sold out or was removed), rather than retrying forever.
  MAX_SUBSCRIPTION_SKIPS: Number(process.env.MAX_SUBSCRIPTION_SKIPS || 3),

  // --- Analytics & monetization (Phase 8) ---
  FEATURED_LISTING: {
    FEE: Number(process.env.FEATURED_LISTING_FEE || 10000),
    DAYS: Number(process.env.FEATURED_LISTING_DAYS || 7),
  },
  PREMIUM_PLAN: {
    MONTHLY_FEE: Number(process.env.PREMIUM_MONTHLY_FEE || 50000),
    // A real, tangible perk for subscribing: a lower cut than the standard
    // rate on every sale — not just a badge. See utils/commissionRate.js.
    COMMISSION_PERCENT: Number(process.env.PREMIUM_COMMISSION_PERCENT || 3),
    MAX_CONSECUTIVE_FAILURES: Number(process.env.PREMIUM_MAX_FAILURES || 2),
  },
  FARM_PREMIUM_STATUS: {
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    CANCELLED: 'cancelled',
  },
  PLATFORM_REVENUE_TYPE: {
    COMMISSION: 'commission',
    FEATURED_LISTING: 'featured_listing',
    PREMIUM_SUBSCRIPTION: 'premium_subscription',
  },
};
