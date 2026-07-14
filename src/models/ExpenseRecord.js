const mongoose = require('mongoose');

// Polymorphic expense record, usable across Livestock, Pet, CoffeeGarden, Plantation, or general farm expenses
const expenseRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    module: { type: String, enum: ['livestock', 'coffee', 'pets', 'plantation', 'general'], required: true },
    subjectType: { type: String, enum: ['Livestock', 'Pet', 'CoffeeGarden', 'Plantation', null], default: null },
    subject: { type: mongoose.Schema.Types.ObjectId, refPath: 'subjectType', default: null },
    category: { type: String, required: true, trim: true }, // feed, labour, fertilizer, transport...
    description: { type: String, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseRecordSchema.index({ farm: 1, module: 1, date: -1 });

expenseRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('ExpenseRecord', expenseRecordSchema);
