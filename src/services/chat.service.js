const { Conversation, Message, User } = require('../models');
const { Op } = require('sequelize');
const responseMetricsService = require('./responseMetrics.service');

/**
 * Handles sending a message from one user to another.
 * Finds or creates a conversation and saves the message.
 * @param {string} senderId - The ID of the user sending the message.
 * @param {string} recipientId - The ID of the user receiving the message.
 * @param {string} content - The content of the message.
 * @returns {Promise<Message>} The saved message object.
 */
const handleSendMessage = async (senderId, recipientId, content) => {
  // Find or create the conversation between the two users
  let conversation = await Conversation.findOne({
    where: {
      [Op.or]: [
        { userOneId: senderId, userTwoId: recipientId },
        { userOneId: recipientId, userTwoId: senderId },
      ],
    },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      userOneId: senderId,
      userTwoId: recipientId,
    });
  }

  // Create the message
  const message = await Message.create({
    conversationId: conversation.id,
    senderId,
    content,
  });

  // Track response metrics for client-provider conversations
  await trackResponseMetrics(message.id, conversation.id, senderId, recipientId);

  // Return the message with sender information
  return Message.findByPk(message.id, {
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'name', 'avatar'],
      },
    ],
  });
};

/**
 * Gets all conversations for a user with presence information.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Conversation[]>} A list of conversations with presence data.
 */
const getConversations = async (userId) => {
  const conversations = await Conversation.findAll({
    where: {
      [Op.or]: [{ userOneId: userId }, { userTwoId: userId }],
    },
    include: [
      {
        model: User,
        as: 'userOne',
        attributes: ['id', 'name', 'avatar', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message'],
      },
      {
        model: User,
        as: 'userTwo',
        attributes: ['id', 'name', 'avatar', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message'],
      },
      {
        model: Message,
        as: 'messages',
        limit: 1,
        order: [['createdAt', 'DESC']],
      },
    ],
    order: [['updatedAt', 'DESC']],
  });

  // Add presence information to each conversation
  const conversationsWithPresence = conversations.map(conversation => {
    const conversationData = conversation.toJSON();
    
    // Determine the other user in the conversation
    const otherUser = conversationData.userOne.id === userId ? conversationData.userTwo : conversationData.userOne;
    
    // Add presence information
    conversationData.otherUserPresence = {
      userId: otherUser.id,
      online_status: otherUser.online_status,
      last_activity: otherUser.last_activity,
      custom_message: otherUser.custom_status_message,
      show_status: otherUser.show_online_status,
      is_online: otherUser.online_status === 'online',
      last_seen_text: getLastSeenText(otherUser)
    };

    return conversationData;
  });

  return conversationsWithPresence;
};

/**
 * Gets all messages for a conversation with sender presence information.
 * @param {number} conversationId - The ID of the conversation.
 * @param {string} requestingUserId - The ID of the user requesting messages.
 * @returns {Promise<Message[]>} A list of messages with presence data.
 */
const getMessages = async (conversationId, requestingUserId = null) => {
  const messages = await Message.findAll({
    where: { conversationId },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'name', 'avatar', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message'],
      },
    ],
    order: [['createdAt', 'ASC']],
  });

  // Add presence information to messages if requesting user is provided
  if (requestingUserId) {
    const messagesWithPresence = messages.map(message => {
      const messageData = message.toJSON();
      
      // Add sender presence information
      messageData.senderPresence = {
        userId: messageData.sender.id,
        online_status: messageData.sender.online_status,
        last_activity: messageData.sender.last_activity,
        custom_message: messageData.sender.custom_status_message,
        show_status: messageData.sender.show_online_status,
        is_online: messageData.sender.online_status === 'online',
        last_seen_text: getLastSeenText(messageData.sender)
      };

      return messageData;
    });

    return messagesWithPresence;
  }

  return messages;
};

/**
 * Get conversation with presence information for both participants
 * @param {string} conversationId - The ID of the conversation
 * @param {string} requestingUserId - The ID of the user requesting the conversation
 * @returns {Promise<object>} Conversation with presence data
 */
const getConversationWithPresence = async (conversationId, requestingUserId) => {
  const conversation = await Conversation.findByPk(conversationId, {
    include: [
      {
        model: User,
        as: 'userOne',
        attributes: ['id', 'name', 'avatar', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message'],
      },
      {
        model: User,
        as: 'userTwo',
        attributes: ['id', 'name', 'avatar', 'online_status', 'last_activity', 'show_online_status', 'custom_status_message'],
      },
    ],
  });

  if (!conversation) {
    return null;
  }

  const conversationData = conversation.toJSON();
  
  // Add presence information for both users
  conversationData.userOnePresence = {
    userId: conversationData.userOne.id,
    online_status: conversationData.userOne.online_status,
    last_activity: conversationData.userOne.last_activity,
    custom_message: conversationData.userOne.custom_status_message,
    show_status: conversationData.userOne.show_online_status,
    is_online: conversationData.userOne.online_status === 'online',
    last_seen_text: getLastSeenText(conversationData.userOne)
  };

  conversationData.userTwoPresence = {
    userId: conversationData.userTwo.id,
    online_status: conversationData.userTwo.online_status,
    last_activity: conversationData.userTwo.last_activity,
    custom_message: conversationData.userTwo.custom_status_message,
    show_status: conversationData.userTwo.show_online_status,
    is_online: conversationData.userTwo.online_status === 'online',
    last_seen_text: getLastSeenText(conversationData.userTwo)
  };

  // Determine the other user for convenience
  const otherUser = conversationData.userOne.id === requestingUserId ? conversationData.userTwo : conversationData.userOne;
  conversationData.otherUserPresence = conversationData.userOne.id === requestingUserId ? conversationData.userTwoPresence : conversationData.userOnePresence;

  return conversationData;
};

/**
 * Helper function to get human-readable last seen text
 * @param {object} user - User object with presence fields
 * @returns {string} Human-readable last seen text
 */
const getLastSeenText = (user) => {
  if (!user.show_online_status) {
    return 'Last seen recently';
  }

  if (user.online_status === 'online') {
    return 'Online now';
  }

  const lastSeen = user.last_activity;
  if (!lastSeen) {
    return 'Last seen recently';
  }

  const now = new Date();
  const diffMs = now - new Date(lastSeen);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Last seen just now';
  } else if (diffMinutes < 60) {
    return `Last seen ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `Last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `Last seen ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return 'Last seen more than a week ago';
  }
};

/**
 * Track response metrics for client-provider conversations
 * @param {string} messageId - The ID of the message
 * @param {string} conversationId - The ID of the conversation
 * @param {string} senderId - The ID of the message sender
 * @param {string} recipientId - The ID of the message recipient
 */
const trackResponseMetrics = async (messageId, conversationId, senderId, recipientId) => {
  try {
    // Get sender and recipient user information
    const [sender, recipient] = await Promise.all([
      User.findByPk(senderId, { attributes: ['id', 'role'] }),
      User.findByPk(recipientId, { attributes: ['id', 'role'] })
    ]);

    // Only track metrics for client-provider conversations
    if (!sender || !recipient) {
      return; // Skip if users not found
    }

    // Case 1: Client sending initial message to provider
    if (sender.role === 'client' && recipient.role === 'provider') {
      await responseMetricsService.trackInitialMessage(
        messageId,
        conversationId,
        senderId,
        recipientId
      );
    }
    // Case 2: Provider responding to client
    else if (sender.role === 'provider' && recipient.role === 'client') {
      await responseMetricsService.trackResponse(
        messageId,
        conversationId,
        senderId,
        recipientId
      );
    }
    // For other role combinations (client-client, provider-provider), no tracking needed
  } catch (error) {
    // Log error but don't fail the message sending process
    console.error('Error tracking response metrics:', error);
  }
};

module.exports = {
  handleSendMessage,
  getConversations,
  getMessages,
  getConversationWithPresence,
  getLastSeenText,
};