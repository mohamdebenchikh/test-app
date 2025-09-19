
const express = require('express');
const { authenticate } = require('../middlewares/auth');
const chatController = require('../controllers/chat.controller');

const router = express.Router();

router.get('/conversations', authenticate, chatController.getConversations);
router.get('/conversations/:conversationId/messages', authenticate, chatController.getMessages);

module.exports = router;
