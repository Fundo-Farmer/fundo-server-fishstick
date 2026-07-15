const mongoose = require('mongoose');
const { RESEARCH_APPLICATION_STATUS } = require('../config/constants');

const researchApplicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    institution: { type: String, trim: true },
    fieldOfStudy: { type: String, trim: true },
    motivation: { type: String, required: true, trim: true },
    attachments: [{ type: String }], // CV / credentials, uploaded images or PDFs

    status: { type: String, enum: Object.values(RESEARCH_APPLICATION_STATUS), default: RESEARCH_APPLICATION_STATUS.PENDING },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
    createdUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // set once approved
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResearchApplication', researchApplicationSchema);
