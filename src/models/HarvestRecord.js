const mongoose = require('mongoose');

// Polymorphic harvest record - used for CoffeeGarden and Plantation subjects
const harvestRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    subjectType: { type: String, enum: ['CoffeeGarden', 'Plantation'], required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'subjectType' },
    date: { type: Date, required: true, default: Date.now },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, default: 'kg' },
    quality: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

harvestRecordSchema.index({ farm: 1, date: -1 });

harvestRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('HarvestRecord', harvestRecordSchema);
