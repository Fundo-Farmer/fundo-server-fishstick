const mongoose = require('mongoose');

// Polymorphic medical record - used for both Livestock and Pet subjects
const medicalRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    subjectType: { type: String, enum: ['Livestock', 'Pet'], required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'subjectType' },
    date: { type: Date, required: true, default: Date.now },
    condition: { type: String, required: true, trim: true },
    treatment: { type: String, trim: true },
    vet: { type: String, trim: true },
    cost: { type: Number, default: 0 },
    followUpDate: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

medicalRecordSchema.index({ farm: 1, date: -1 });

medicalRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
