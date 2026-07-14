const mongoose = require('mongoose');

// Polymorphic crop health record - used for CoffeeGarden and Plantation subjects
const healthRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    subjectType: { type: String, enum: ['CoffeeGarden', 'Plantation'], required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'subjectType' },
    date: { type: Date, required: true, default: Date.now },
    issue: { type: String, required: true, trim: true }, // e.g. leaf rust, black sigatoka
    treatment: { type: String, trim: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    cost: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

healthRecordSchema.index({ farm: 1, date: -1 });

healthRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
