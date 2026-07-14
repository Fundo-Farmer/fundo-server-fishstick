const mongoose = require('mongoose');

const coffeeGardenSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    variety: { type: String, trim: true }, // Robusta, Arabica, etc.
    sizeAcres: { type: Number },
    numberOfTrees: { type: Number },
    location: { type: String, trim: true },
    plantedDate: { type: Date },
    photos: [{ type: String }],
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

coffeeGardenSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('CoffeeGarden', coffeeGardenSchema);
