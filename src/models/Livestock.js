const mongoose = require('mongoose');

const livestockSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true }, // e.g. Cow, Goat, Sheep, Pig, Chicken
    breed: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    dateOfBirth: { type: Date },
    tagNumber: { type: String, trim: true },
    parentMale: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestock', default: null },
    parentFemale: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestock', default: null },
    photos: [{ type: String }],
    status: { type: String, enum: ['active', 'sold', 'deceased', 'transferred'], default: 'active' },
    weightKg: { type: Number },
    notes: { type: String, trim: true },
    acquiredFrom: { type: String, enum: ['born_on_farm', 'purchased', 'gifted'], default: 'born_on_farm' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

livestockSchema.index({ farm: 1, species: 1 });

livestockSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('Livestock', livestockSchema);
