const mongoose = require('mongoose');

const plantationSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    cropType: { type: String, required: true, trim: true }, // Banana, Maize, Beans, etc.
    variety: { type: String, trim: true },
    sizeAcres: { type: Number },
    location: { type: String, trim: true },
    plantedDate: { type: Date },
    photos: [{ type: String }],
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

plantationSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('Plantation', plantationSchema);
