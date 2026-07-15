const { DELIVERY_ZONE, ZONE_ALLOWED_VEHICLES } = require('../config/constants');
const User = require('../models/User');
const Farm = require('../models/Farm');
const { getSettings } = require('./settingsService');

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lng points, in kilometres.
 * Plain math — no geocoding API involved (there isn't one wired up; see README).
 */
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
};

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Computes a delivery quote (zone, distance, fee, allowed vehicle types, and a
 * rough ETA for long-haul trips) between a pickup point (the farm/seller) and
 * a dropoff point (the buyer's delivery address).
 *
 * Falls back to a flat fee with an "unknown" zone if either point is missing
 * coordinates — e.g. a seller without a farm, or a buyer who skipped the map.
 *
 * Pricing itself is admin-configurable (see utils/settingsService.js) rather
 * than fixed at deploy time — this is async purely to read that.
 */
const quoteDelivery = async (pickup, dropoff) => {
  const settings = await getSettings();
  const {
    localRadiusKm, localBaseFee, localFeePerKm, longHaulBaseFee, longHaulFeePerKm, fallbackFlatFee, longHaulKmPerDay,
  } = settings.deliveryPricing;

  if (!pickup?.lat || !pickup?.lng || !dropoff?.lat || !dropoff?.lng) {
    return {
      zone: DELIVERY_ZONE.UNKNOWN,
      distanceKm: null,
      fee: fallbackFlatFee,
      allowedVehicleTypes: ZONE_ALLOWED_VEHICLES.unknown,
      estimatedDays: null,
    };
  }

  const distanceKm = round2(haversineKm(pickup, dropoff));

  if (distanceKm <= localRadiusKm) {
    return {
      zone: DELIVERY_ZONE.LOCAL,
      distanceKm,
      fee: Math.round(localBaseFee + distanceKm * localFeePerKm),
      allowedVehicleTypes: ZONE_ALLOWED_VEHICLES.local,
      estimatedDays: null, // same-day, no need to show a day estimate
    };
  }

  return {
    zone: DELIVERY_ZONE.LONG_HAUL,
    distanceKm,
    fee: Math.round(longHaulBaseFee + distanceKm * longHaulFeePerKm),
    allowedVehicleTypes: ZONE_ALLOWED_VEHICLES.long_haul,
    estimatedDays: Math.max(1, Math.ceil(distanceKm / longHaulKmPerDay)),
  };
};

/**
 * Resolves a seller's pickup point for delivery pricing: the coordinates of
 * the farm they're associated with (as farm_admin or worker — the same
 * association used everywhere else in the app, via User.farm) if any,
 * otherwise nothing (falls back to a flat fee, via quoteDelivery above).
 * Shared by checkout, delivery quoting, and subscriptions/pre-orders.
 */
const getSellerPickupPoint = async (sellerId) => {
  const seller = await User.findById(sellerId).select('farm');
  if (!seller?.farm) return { lat: null, lng: null, address: null, farmId: null };
  const farm = await Farm.findById(seller.farm);
  if (!farm) return { lat: null, lng: null, address: null, farmId: null };
  return { lat: farm.coordinates?.lat, lng: farm.coordinates?.lng, address: farm.location, farmId: farm._id };
};

module.exports = { haversineKm, quoteDelivery, getSellerPickupPoint };
