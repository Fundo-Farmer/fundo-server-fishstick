const mongoose = require('mongoose');

// Polymorphic internal sale record (distinct from public marketplace listings)
const saleRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    module: { type: String, enum: ['livestock', 'coffee', 'pets', 'plantation'], required: true },
    subjectType: { type: String, enum: ['Livestock', 'Pet', 'CoffeeGarden', 'Plantation'], required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'subjectType' },
    buyerName: { type: String, trim: true },
    buyerContact: { type: String, trim: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'unit' },
    pricePerUnit: { type: Number, required: true },
    total: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

saleRecordSchema.pre('validate', function computeTotal(next) {
  if (this.pricePerUnit != null && this.quantity != null) {
    this.total = Number((this.pricePerUnit * this.quantity).toFixed(2));
  }
  next();
});

saleRecordSchema.index({ farm: 1, module: 1, date: -1 });

saleRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('SaleRecord', saleRecordSchema);
