const mongoose = require('mongoose');
const { DELIVERY_ZONE, DELIVERY_STATUS, VEHICLE_TYPES } = require('../config/constants');

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courier: { type: mongoose.Schema.Types.ObjectId, ref: 'Courier', default: null, index: true },

    pickup: {
      address: { type: String, trim: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    dropoff: {
      address: { type: String, trim: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    zone: { type: String, enum: Object.values(DELIVERY_ZONE), required: true },
    distanceKm: { type: Number, default: null },
    fee: { type: Number, required: true },
    allowedVehicleTypes: { type: [{ type: String, enum: VEHICLE_TYPES }], default: [] },
    estimatedDays: { type: Number, default: null }, // set for long-haul only

    status: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.UNASSIGNED },
    statusHistory: { type: [statusEventSchema], default: () => [{ status: DELIVERY_STATUS.UNASSIGNED }] },
    failureReason: { type: String, trim: true },

    // A pre-pickup failure gets automatically reopened for another courier to
    // claim (up to a limit) rather than immediately giving up — see
    // deliveryController.updateDeliveryStatus and constants.MAX_DELIVERY_REASSIGNMENTS.
    reassignmentCount: { type: Number, default: 0 },
    previousCouriers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Courier' }],
    feeRefunded: { type: Boolean, default: false },

    assignedAt: { type: Date },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

deliverySchema.index({ status: 1, zone: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
