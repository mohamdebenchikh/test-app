/**
 * @fileoverview Utility functions for broadcasting presence updates to relevant users
 * @module utils/presenceBroadcast
 */

const logger = require('./logger');
const { User, Conversation, UserSession } = require('../models');
const { Op } = require('sequelize');

/**
 * Get users who should receive presence updates for a specific user
 * This includes users who have active conversations with the user
 * @param {string} userId - The user whose presence changed
 * @returns {Promise<string[]>} Array of user IDs who should receive updates
 */
const getRelevantUsersForPresence = async (userId) => {
  try {
    // Find all conversations where this user is a participant
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { userOneId: userId },
          { userTwoId: userId }
        ]
      },
      attributes: ['userOneId', 'userTwoId']
    });

    // Extract the other participants from conversations
    const relevantUserIds = new Set();
    
    conversations.forEach(conversation => {
      if (conversation.userOneId === userId) {
        relevantUserIds.add(conversation.userTwoId);
      } else {
        relevantUserIds.add(conversation.userOneId);
      }
    });

    return Array.from(relevantUserIds);
  } catch (error) {
    logger.error('Error getting relevant users for presence:', error);
    return [];
  }
};

/**
 * Get users in the same city who are providers (for client presence updates)
 * @param {string} userId - The user whose presence changed
 * @returns {Promise<string[]>} Array of provider user IDs in the same city
 */
const getProvidersInSameCity = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['city_id', 'role']
    });

    if (!user || !user.city_id) {
      return [];
    }

    // If user is a client, get providers in the same city
    // If user is a provider, get clients in the same city
    const targetRole = user.role === 'client' ? 'provider' : 'client';

    const usersInCity = await User.findAll({
      where: {
        city_id: user.city_id,
        role: targetRole,
        active: true,
        id: { [Op.ne]: userId } // Exclude the user themselves
      },
      attributes: ['id']
    });

    return usersInCity.map(u => u.id);
  } catch (error) {
    logger.error('Error getting providers in same city:', error);
    return [];
  }
};

/**
 * Broadcast presence update to relevant users
 * @param {object} io - Socket.IO server instance
 * @param {string} userId - The user whose presence changed
 * @param {object} presenceData - The presence data to broadcast
 * @param {object} options - Broadcasting options
 */
const broadcastPresenceUpdate = async (io, userId, presenceData, options = {}) => {
  try {
    const { 
      includeConversationParticipants = true, 
      includeCityUsers = false,
      excludeUsers = []
    } = options;

    let relevantUserIds = [];

    // Get conversation participants
    if (includeConversationParticipants) {
      const conversationUsers = await getRelevantUsersForPresence(userId);
      relevantUserIds = [...relevantUserIds, ...conversationUsers];
    }

    // Get users in same city (for provider/client visibility)
    if (includeCityUsers) {
      const cityUsers = await getProvidersInSameCity(userId);
      relevantUserIds = [...relevantUserIds, ...cityUsers];
    }

    // Remove duplicates and excluded users
    relevantUserIds = [...new Set(relevantUserIds)].filter(id => !excludeUsers.includes(id));

    // Broadcast to each relevant user's room
    const broadcastData = {
      userId,
      ...presenceData,
      timestamp: new Date()
    };

    relevantUserIds.forEach(targetUserId => {
      io.to(targetUserId).emit('presenceUpdate', broadcastData);
    });

    logger.debug(`Broadcasted presence update for user ${userId} to ${relevantUserIds.length} users`);
    
    return relevantUserIds;
  } catch (error) {
    logger.error('Error broadcasting presence update:', error);
    return [];
  }
};

/**
 * Broadcast typing indicator to conversation participant
 * @param {object} io - Socket.IO server instance
 * @param {string} senderId - The user who is typing
 * @param {string} recipientId - The user who should receive the typing indicator
 * @param {boolean} isTyping - Whether the user is typing or stopped typing
 */
const broadcastTypingIndicator = (io, senderId, recipientId, isTyping) => {
  try {
    const typingData = {
      userId: senderId,
      isTyping,
      timestamp: new Date()
    };

    io.to(recipientId).emit('userTyping', typingData);
    
    logger.debug(`Typing indicator sent from ${senderId} to ${recipientId}: ${isTyping}`);
  } catch (error) {
    logger.error('Error broadcasting typing indicator:', error);
  }
};

/**
 * Broadcast user online status change
 * @param {object} io - Socket.IO server instance
 * @param {string} userId - The user whose status changed
 * @param {string} status - The new status ('online', 'offline', 'away', 'dnd')
 * @param {object} options - Broadcasting options
 */
const broadcastStatusChange = async (io, userId, status, options = {}) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      logger.error(`User ${userId} not found for status broadcast`);
      return;
    }

    const presenceData = {
      status,
      last_activity: user.last_activity,
      custom_message: user.custom_status_message,
      show_status: user.show_online_status
    };

    // Only broadcast if user allows showing status
    if (user.show_online_status) {
      await broadcastPresenceUpdate(io, userId, presenceData, {
        includeConversationParticipants: true,
        includeCityUsers: options.includeCityUsers || false
      });
    }

    logger.info(`Status change broadcasted for user ${userId}: ${status}`);
  } catch (error) {
    logger.error('Error broadcasting status change:', error);
  }
};

/**
 * Broadcast custom status message update
 * @param {object} io - Socket.IO server instance
 * @param {string} userId - The user whose custom status changed
 * @param {string} status - The status
 * @param {string} message - The custom message
 */
const broadcastCustomStatus = async (io, userId, status, message) => {
  try {
    const presenceData = {
      status,
      custom_message: message
    };

    await broadcastPresenceUpdate(io, userId, presenceData, {
      includeConversationParticipants: true
    });

    logger.info(`Custom status broadcasted for user ${userId}: ${status} - ${message}`);
  } catch (error) {
    logger.error('Error broadcasting custom status:', error);
  }
};

/**
 * Get active socket IDs for a user
 * @param {string} userId - The user ID
 * @returns {Promise<string[]>} Array of active socket IDs
 */
const getActiveSocketIds = async (userId) => {
  try {
    const sessions = await UserSession.findAll({
      where: {
        user_id: userId,
        is_active: true
      },
      attributes: ['socket_id']
    });

    return sessions.map(session => session.socket_id).filter(Boolean);
  } catch (error) {
    logger.error('Error getting active socket IDs:', error);
    return [];
  }
};

module.exports = {
  getRelevantUsersForPresence,
  getProvidersInSameCity,
  broadcastPresenceUpdate,
  broadcastTypingIndicator,
  broadcastStatusChange,
  broadcastCustomStatus,
  getActiveSocketIds
};