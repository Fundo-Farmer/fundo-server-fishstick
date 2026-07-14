const mongoose = require('mongoose');
const { VEHICLE_TYPES, COURIER_VERIFICATION_STATUS } = require('../config/constants');

const courierSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehiclePlate: { type: String, trim: true }, // not required — bicycles don't have one
    serviceRadiusKm: { type: Number, default: 15 }, // how far from base they'll take local jobs

    baseLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    baseAddress: { type: String, trim: true },

    isAvailable: { type: Boolean, default: false }, // toggled by the courier — "on shift"

    // KYC — same shape as Farm.verification, reviewed by a Fundo admin before a
    // courier can claim any deliveries. Documents are permit + national ID photos.
    verification: {
      status: { type: String, enum: Object.values(COURIER_VERIFICATION_STATUS), default: COURIER_VERIFICATION_STATUS.UNVERIFIED },
      requestNote: { type: String, trim: true },
      documents: [{ type: String }],
      requestedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewNote: { type: String, trim: true },
    },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedDeliveries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Courier', courierSchema);
