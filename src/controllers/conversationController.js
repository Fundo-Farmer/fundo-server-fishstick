const asyncHandler = require('express-async-handler');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const notify = require('../utils/notify');

// Handles both populated participants (full user docs, e.g. after .populate())
// and unpopulated ones (raw ObjectIds) — callers use both.
const isParticipant = (conversation, userId) =>
  conversation.participants.some((p) => String(p._id || p) === String(userId));

const myReadEntry = (conversation, userId) =>
  conversation.readStatus.find((r) => String(r.user) === String(userId));

// @desc  Start (or resume) a conversation with another user
// @route POST /api/conversations
const startConversation = asyncHandler(async (req, res) => {
  const { recipientId, context, message } = req.body;
  if (!recipientId) {
    res.status(400);
    throw new Error('A recipient is required.');
  }
  if (String(recipientId) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot message yourself.');
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, recipientId], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, recipientId],
      context: context?.refId ? { type: context.type, refId: context.refId, label: context.label } : undefined,
      readStatus: [
        { user: req.user._id, lastReadAt: new Date() },
        { user: recipientId, lastReadAt: new Date(0) },
      ],
    });
  }

  if (message) {
    await Message.create({ conversation: conversation._id, sender: req.user._id, body: message });
    conversation.lastMessage = { body: message, sender: req.user._id, at: new Date() };
    const mine = myReadEntry(conversation, req.user._id);
    if (mine) mine.lastReadAt = new Date();
    await conversation.save();

    await notify(recipientId, {
      type: 'new_message',
      title: `New message from ${req.user.name}`,
      body: message.slice(0, 140),
      link: `/messages/${conversation._id}`,
    });
  }

  res.status(201).json({ success: true, data: conversation });
});

// @desc  List my conversations, most recently active first, with unread counts
// @route GET /api/conversations
const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id })
    .populate('participants', 'name avatar')
    .sort({ 'lastMessage.at': -1 });

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const mine = myReadEntry(c, req.user._id);
      const unreadCount = await Message.countDocuments({
        conversation: c._id,
        sender: { $ne: req.user._id },
        createdAt: { $gt: mine?.lastReadAt || new Date(0) },
      });
      const other = c.participants.find((p) => String(p._id) !== String(req.user._id));
      return { ...c.toObject(), otherParticipant: other, unreadCount };
    })
  );

  res.json({ success: true, data: withUnread });
});

// @desc  Get a conversation's messages
// @route GET /api/conversations/:id/messages
const getMessages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id).populate('participants', 'name avatar');
  if (!conversation) {
    res.status(404);
    throw new Error('Conversation not found.');
  }
  if (!isParticipant(conversation, req.user._id)) {
    res.status(403);
    throw new Error('You are not part of this conversation.');
  }
  const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 }).limit(200);
  res.json({ success: true, data: { conversation, messages } });
});

// @desc  Send a message in an existing conversation
// @route POST /api/conversations/:id/messages
const sendMessage = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id).populate('participants', 'name phone');
  if (!conversation) {
    res.status(404);
    throw new Error('Conversation not found.');
  }
  if (!isParticipant(conversation, req.user._id)) {
    res.status(403);
    throw new Error('You are not part of this conversation.');
  }
  const { body } = req.body;
  if (!body || !body.trim()) {
    res.status(400);
    throw new Error('Message cannot be empty.');
  }

  const message = await Message.create({ conversation: conversation._id, sender: req.user._id, body });
  conversation.lastMessage = { body, sender: req.user._id, at: new Date() };
  const mine = myReadEntry(conversation, req.user._id);
  if (mine) mine.lastReadAt = new Date();
  else conversation.readStatus.push({ user: req.user._id, lastReadAt: new Date() });
  await conversation.save();

  const recipient = conversation.participants.find((p) => String(p._id) !== String(req.user._id));
  await notify(recipient._id, {
    type: 'new_message',
    title: `New message from ${req.user.name}`,
    body: body.slice(0, 140),
    link: `/messages/${conversation._id}`,
    sms: true, // a new message is time-sensitive enough to also try SMS
  });

  res.status(201).json({ success: true, data: message });
});

// @desc  Mark a conversation as read
// @route PUT /api/conversations/:id/read
const markConversationRead = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) {
    res.status(404);
    throw new Error('Conversation not found.');
  }
  if (!isParticipant(conversation, req.user._id)) {
    res.status(403);
    throw new Error('You are not part of this conversation.');
  }
  const mine = myReadEntry(conversation, req.user._id);
  if (mine) mine.lastReadAt = new Date();
  else conversation.readStatus.push({ user: req.user._id, lastReadAt: new Date() });
  await conversation.save();
  res.json({ success: true });
});

module.exports = { startConversation, listConversations, getMessages, sendMessage, markConversationRead };
