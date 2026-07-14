const mongoose = require('mongoose');

// Records a birth event; offspring may separately be registered as new Livestock/Pet entries
const birthRecordSchema = new mongoose.Schema(
  {
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    subjectType: { type: String, enum: ['Livestock', 'Pet'], required: true },
    mother: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'subjectType' },
    father: { type: mongoose.Schema.Types.ObjectId, refPath: 'subjectType', default: null },
    date: { type: Date, required: true, default: Date.now },
    offspringCount: { type: Number, required: true, default: 1 },
    offspring: [{ type: mongoose.Schema.Types.ObjectId, refPath: 'subjectType' }],
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

birthRecordSchema.plugin(require('../utils/clientIdPlugin'));

module.exports = mongoose.model('BirthRecord', birthRecordSchema);
