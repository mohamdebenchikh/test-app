const catchAsync = require('../utils/catchAsync');
const chatService = require('../services/chat.service');

const getConversations = catchAsync(async (req, res) => {
  // The user ID is in the 'sub' field of the decoded token
  const conversations = await chatService.getConversations(req.user.sub);
  res.status(200).json(conversations);
});

const getMessages = catchAsync(async (req, res) => {
  const messages = await chatService.getMessages(req.params.conversationId, req.user.sub);
  res.status(200).json(messages);
});

module.exports = {
  getConversations,
  getMessages,
};