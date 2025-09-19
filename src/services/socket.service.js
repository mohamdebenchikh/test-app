const logger = require('../utils/logger');
const { verifyToken } = require('../utils/jwt');
const chatService = require('./chat.service');
const presenceService = require('./presence.service');
const notificationService = require('./notification.service');
const { 
  broadcastPresenceUpdate, 
  broadcastTypingIndicator, 
  broadcastStatusChange,
  broadcastCustomStatus 
} = require('../utils/presenceBroadcast');

// Log that the module is being imported
logger.info('Socket service module imported');

// Check if chatService is properly imported
if (!chatService || !chatService.handleSendMessage) {
  logger.error('Chat service not properly imported');
} else {
  logger.info('Chat service properly imported');
}

/**
 * Initializes the socket.io service.
 * @param {object} io - The socket.io server instance.
 */
module.exports = (io) => {
  logger.info('Socket service initialization started');
  
  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    logger.info('Socket authentication middleware called');
    
    if (!token) {
      logger.error('Authentication error: Token not provided.');
      return next(new Error('Authentication error: Token not provided.'));
    }

    try {
      const decoded = verifyToken(token);
      socket.user = decoded;
      // Ensure we have the user ID in the expected format
      socket.user.id = decoded.sub || decoded.id;
      logger.info(`Socket authenticated for user: ${socket.user.id}`);
      next();
    } catch (error) {
      logger.error('Authentication error: Invalid token.', error);
      return next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', async (socket) => {
    logger.info(`New client connected: ${socket.id}, User: ${socket.user.id}`);

    // Join a room based on the user's ID
    socket.join(socket.user.id);

    // Set user online and create session
    try {
      const deviceInfo = {
        device_type: socket.handshake.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'web',
        ip_address: socket.handshake.address,
        user_agent: socket.handshake.headers['user-agent']
      };
      
      await presenceService.setUserOnline(socket.user.id, socket.id, deviceInfo);
      
      // Broadcast presence update to relevant users using the new broadcasting system
      await broadcastStatusChange(io, socket.user.id, 'online', {
        includeCityUsers: false // Only broadcast to conversation participants for privacy
      });
      
      logger.info(`User ${socket.user.id} set online with socket ${socket.id}`);
    } catch (error) {
      logger.error('Error setting user online:', error);
    }

    socket.on('disconnect', async () => {
      logger.info(`Client disconnected: ${socket.id}`);
      
      // Set user offline and handle session cleanup
      try {
        await presenceService.setUserOffline(socket.user.id, socket.id);
        
        // Broadcast presence update to relevant users using the new broadcasting system
        await broadcastStatusChange(io, socket.user.id, 'offline', {
          includeCityUsers: false // Only broadcast to conversation participants for privacy
        });
        
        logger.info(`User ${socket.user.id} session ${socket.id} set offline`);
      } catch (error) {
        logger.error('Error setting user offline:', error);
      }
    });

    socket.on('sendMessage', async (data, callback) => {
      try {
        logger.info(`Received sendMessage event from user ${socket.user.id}:`, data);
        
        const { recipientId, content } = data;
        const senderId = socket.user.id;

        if (!recipientId || !content) {
          logger.error('Recipient and content are required.');
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'Recipient and content are required.' });
          }
          return;
        }

        // Check if chatService.handleSendMessage exists
        if (!chatService.handleSendMessage) {
          logger.error('handleSendMessage function not found in chatService');
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'Internal server error.' });
          }
          return;
        }

        const message = await chatService.handleSendMessage(senderId, recipientId, content);
        logger.info(`Message created:`, message.toJSON());

        // Send message to recipient with presence information
        logger.info(`Sending message to recipient room: ${recipientId}`);
        const messageWithPresence = message.toJSON();
        messageWithPresence.senderPresence = {
          userId: senderId,
          online_status: 'online', // Sender is online since they're sending a message
          timestamp: new Date()
        };
        io.to(recipientId).emit('newMessage', messageWithPresence);

        // Send message back to sender for confirmation
        logger.info(`Sending message to sender room: ${senderId}`);
        io.to(senderId).emit('newMessage', messageWithPresence);

        // Send chat notification with presence information
        await notificationService.createChatNotification(io, recipientId, senderId, content);

        if (callback && typeof callback === 'function') {
          callback({ status: 'ok', message });
        }
      } catch (error) {
        logger.error('Error sending message:', error);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: 'An error occurred while sending the message.' });
        }
      }
    });

    // Handle activity updates for presence tracking
    socket.on('activity', async () => {
      try {
        await presenceService.updateLastActivity(socket.user.id);
        logger.debug(`Activity updated for user ${socket.user.id}`);
      } catch (error) {
        logger.error('Error updating user activity:', error);
      }
    });

    // Handle custom status updates
    socket.on('setStatus', async (data, callback) => {
      try {
        const { status, message } = data;
        
        if (!status) {
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'Status is required.' });
          }
          return;
        }

        await presenceService.setCustomStatus(socket.user.id, status, message);
        
        // Broadcast status update to relevant users using the new broadcasting system
        await broadcastCustomStatus(io, socket.user.id, status, message);

        if (callback && typeof callback === 'function') {
          callback({ status: 'ok', message: 'Status updated successfully.' });
        }
        
        logger.info(`User ${socket.user.id} status updated to ${status}`);
      } catch (error) {
        logger.error('Error setting custom status:', error);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: 'Failed to update status.' });
        }
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      try {
        const { recipientId, isTyping } = data;
        
        if (!recipientId) {
          return;
        }

        // Send typing indicator to recipient using the broadcasting utility
        broadcastTypingIndicator(io, socket.user.id, recipientId, isTyping);
        
        logger.debug(`Typing indicator sent from ${socket.user.id} to ${recipientId}: ${isTyping}`);
      } catch (error) {
        logger.error('Error handling typing indicator:', error);
      }
    });

    // Handle presence requests
    socket.on('getPresence', async (data, callback) => {
      try {
        const { userId } = data;
        
        if (!userId) {
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'User ID is required.' });
          }
          return;
        }

        const presence = await presenceService.getUserPresence(userId);
        
        if (callback && typeof callback === 'function') {
          callback({ status: 'ok', presence });
        }
      } catch (error) {
        logger.error('Error getting user presence:', error);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: 'Failed to get user presence.' });
        }
      }
    });

    // Handle conversation join for targeted presence updates
    socket.on('joinConversation', async (data, callback) => {
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'Conversation ID is required.' });
          }
          return;
        }

        // Join conversation room for targeted updates
        socket.join(`conversation_${conversationId}`);
        
        // Get conversation with presence information
        const conversation = await chatService.getConversationWithPresence(conversationId, socket.user.id);
        
        if (!conversation) {
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'Conversation not found.' });
          }
          return;
        }
        
        if (callback && typeof callback === 'function') {
          callback({ status: 'ok', conversation });
        }
        
        logger.debug(`User ${socket.user.id} joined conversation ${conversationId}`);
      } catch (error) {
        logger.error('Error joining conversation:', error);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: 'Failed to join conversation.' });
        }
      }
    });

    // Handle conversation leave
    socket.on('leaveConversation', (data) => {
      try {
        const { conversationId } = data;
        
        if (conversationId) {
          socket.leave(`conversation_${conversationId}`);
          logger.debug(`User ${socket.user.id} left conversation ${conversationId}`);
        }
      } catch (error) {
        logger.error('Error leaving conversation:', error);
      }
    });

    // Handle presence request for specific users
    socket.on('requestPresence', async (data, callback) => {
      try {
        const { userIds } = data;
        
        if (!userIds || !Array.isArray(userIds)) {
          if (callback && typeof callback === 'function') {
            return callback({ status: 'error', message: 'User IDs array is required.' });
          }
          return;
        }

        const presenceData = {};
        
        for (const userId of userIds) {
          try {
            const presence = await presenceService.getUserPresence(userId);
            presenceData[userId] = presence;
          } catch (error) {
            logger.error(`Error getting presence for user ${userId}:`, error);
            presenceData[userId] = null;
          }
        }
        
        if (callback && typeof callback === 'function') {
          callback({ status: 'ok', presence: presenceData });
        }
      } catch (error) {
        logger.error('Error handling presence request:', error);
        if (callback && typeof callback === 'function') {
          callback({ status: 'error', message: 'Failed to get presence data.' });
        }
      }
    });

    // Handle socket errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
      // Attempt to handle presence cleanup on error
      presenceService.setUserOffline(socket.user.id, socket.id).catch(err => {
        logger.error('Error cleaning up presence on socket error:', err);
      });
    });
  });
  
  logger.info('Socket service initialization completed');
};