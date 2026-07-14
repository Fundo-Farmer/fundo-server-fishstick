const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true }, // Dog, Cat, Rabbit, etc.
    breed: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    dateOfBirth: { type: Date },
    parentMale: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', default: null },
    parentFemale: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', default: null },
    photos: [{ type: String }],
    status: { type: String, enum: ['active', 'sold', 'deceased', 'transferred'], default: 'active' },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

petSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('Pet', petSchema);
