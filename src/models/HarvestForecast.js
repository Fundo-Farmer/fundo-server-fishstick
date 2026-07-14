const mongoose = require('mongoose');
const { HARVEST_FORECAST_STATUS } = require('../config/constants');

const harvestForecastSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    subjectType: { type: String, enum: ['CoffeeGarden', 'Plantation'], required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'subjectType' },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    images: [{ type: String }],

    expectedDate: { type: Date, required: true },
    expectedQuantity: { type: Number, required: true },
    unit: { type: String, required: true, default: 'kg' },
    pricePerUnit: { type: Number, required: true },

    // Running total of quantity locked in by active (non-cancelled) pre-orders —
    // kept in sync in preOrderController rather than computed on every read.
    quantityReserved: { type: Number, default: 0 },

    status: { type: String, enum: Object.values(HARVEST_FORECAST_STATUS), default: HARVEST_FORECAST_STATUS.OPEN },
  },
  { timestamps: true }
);

harvestForecastSchema.index({ status: 1, expectedDate: 1 });

module.exports = mongoose.model('HarvestForecast', harvestForecastSchema);
