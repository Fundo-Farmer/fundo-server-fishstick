const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    data: { type: mongoose.Schema.Types.Mixed }, // computed snapshot used to render the PDF
    pdfPath: { type: String },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

reportSchema.index({ farm: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
