const express = require('express');
const {
  startConversation, listConversations, getMessages, sendMessage, markConversationRead,
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', listConversations);
router.post('/', startConversation);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);
router.put('/:id/read', markConversationRead);

module.exports = router;
