const mongoose = require('mongoose');

// Livestock produce, e.g. milk, eggs, wool
const produceRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    livestock: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestock', default: null },
    produceType: { type: String, required: true, trim: true }, // milk, eggs, wool...
    date: { type: Date, required: true, default: Date.now },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, default: 'litres' },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

produceRecordSchema.index({ farm: 1, date: -1 });

produceRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('ProduceRecord', produceRecordSchema);
