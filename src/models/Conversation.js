const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: (v) => v.length === 2,
    },
    // What started the conversation, if anything — shown as context in the thread.
    context: {
      type: { type: String, enum: ['listing', 'auction', 'order', null], default: null },
      refId: { type: mongoose.Schema.Types.ObjectId, default: null },
      label: { type: String, trim: true }, // snapshot title, so it still makes sense if the listing is later removed
    },
    lastMessage: {
      body: { type: String, trim: true },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
    // Per-participant read tracking, so unread counts work without a separate collection.
    readStatus: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessage.at': -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
