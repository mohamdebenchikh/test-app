/**
 * @fileoverview Presence service for managing user online status and activity.
 * @module services/presence
 */

const { User, UserSession, ProviderService, Service, City } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Set user as online and create/update session
 * @param {string} userId - The user's ID
 * @param {string} socketId - The socket ID
 * @param {object} deviceInfo - Device information
 * @returns {Promise<UserSession>}
 */
const setUserOnline = async (userId, socketId, deviceInfo = {}) => {
  try {
    // Update user online status
    await User.update(
      { 
        online_status: 'online',
        last_activity: new Date()
      },
      { where: { id: userId } }
    );

    // Create or update user session
    const sessionData = {
      user_id: userId,
      socket_id: socketId,
      device_type: deviceInfo.device_type || 'web',
      ip_address: deviceInfo.ip_address,
      user_agent: deviceInfo.user_agent,
      connected_at: new Date(),
      last_ping: new Date(),
      is_active: true
    };

    // Check if session already exists for this socket
    let session = await UserSession.findOne({ where: { socket_id: socketId } });
    
    if (session) {
      await session.update(sessionData);
    } else {
      session = await UserSession.create(sessionData);
    }

    logger.info(`User ${userId} set online with session ${session.id}`);
    return session;
  } catch (error) {
    logger.error('Error setting user online:', error);
    throw error;
  }
};

/**
 * Set user as offline and deactivate session
 * @param {string} userId - The user's ID
 * @param {string} socketId - The socket ID
 * @returns {Promise<void>}
 */
const setUserOffline = async (userId, socketId) => {
  try {
    // Deactivate the specific session
    await UserSession.update(
      { is_active: false },
      { where: { socket_id: socketId, user_id: userId } }
    );

    // Check if user has any other active sessions
    const activeSessions = await UserSession.count({
      where: { 
        user_id: userId, 
        is_active: true 
      }
    });

    // If no active sessions, set user offline
    if (activeSessions === 0) {
      await User.update(
        { 
          online_status: 'offline',
          last_activity: new Date()
        },
        { where: { id: userId } }
      );
    }

    logger.info(`User ${userId} session ${socketId} set offline`);
  } catch (error) {
    logger.error('Error setting user offline:', error);
    throw error;
  }
};

/**
 * Update user's last activity timestamp
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
const updateLastActivity = async (userId) => {
  try {
    await User.update(
      { last_activity: new Date() },
      { where: { id: userId } }
    );

    // Also update all active sessions for this user
    await UserSession.update(
      { last_ping: new Date() },
      { 
        where: { 
          user_id: userId, 
          is_active: true 
        } 
      }
    );
  } catch (error) {
    logger.error('Error updating last activity:', error);
    throw error;
  }
};

/**
 * Get user's current presence information with privacy controls
 * @param {string} userId - The user's ID
 * @param {string} requestingUserId - The ID of the user requesting the presence info (optional)
 * @returns {Promise<object>}
 */
const getUserPresence = async (userId, requestingUserId = null) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user.getPresenceInfo(requestingUserId);
  } catch (error) {
    logger.error('Error getting user presence:', error);
    throw error;
  }
};

/**
 * Get online providers in a city with optional service filter and privacy controls
 * @param {string} cityId - The city ID
 * @param {string} serviceId - Optional service ID filter
 * @param {object} filters - Additional filters
 * @returns {Promise<User[]>}
 */
const getOnlineProviders = async (cityId, serviceId = null, filters = {}) => {
  try {
    const whereClause = {
      role: 'provider',
      city_id: cityId,
      active: true,
      show_online_status: true // Only show providers who allow showing their status
    };

    // Apply presence filters with privacy considerations
    if (filters.online_status) {
      if (filters.online_status === 'online') {
        // For online filter, exclude DND users as they appear offline
        whereClause.online_status = 'online';
      } else {
        whereClause.online_status = filters.online_status;
      }
    } else if (filters.active_within) {
      const timeAgo = getTimeAgoDate(filters.active_within);
      whereClause.last_activity = {
        [Op.gte]: timeAgo
      };
      // Exclude DND users from active filters
      whereClause.online_status = { [Op.ne]: 'dnd' };
    }

    const includeOptions = [];

    // Add service filter if provided
    if (serviceId) {
      includeOptions.push({
        model: Service,
        through: { model: ProviderService },
        where: { id: serviceId },
        required: true
      });
    }

    const providers = await User.findAll({
      where: whereClause,
      include: includeOptions,
      attributes: {
        exclude: ['password']
      },
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      order: [
        ['online_status', 'DESC'], // Online users first
        ['last_activity', 'DESC']  // Most recently active first
      ]
    });

    return providers;
  } catch (error) {
    logger.error('Error getting online providers:', error);
    throw error;
  }
};

/**
 * Set custom status for user with privacy validation
 * @param {string} userId - The user's ID
 * @param {string} status - The status ('online', 'away', 'dnd', 'offline')
 * @param {string} message - Optional custom message
 * @returns {Promise<void>}
 */
const setCustomStatus = async (userId, status, message = null) => {
  try {
    const validStatuses = ['online', 'offline', 'away', 'dnd'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    // Validate custom message length
    if (message && message.length > 100) {
      throw new Error('Custom status message cannot exceed 100 characters');
    }

    // Handle DND and Away status logic
    const updateData = { 
      online_status: status,
      custom_status_message: message,
      last_activity: new Date()
    };

    // Note: DND and Away status visibility is handled in the getPresenceInfo method
    // We don't modify show_online_status here as it's a user privacy preference

    await User.update(updateData, { where: { id: userId } });

    logger.info(`User ${userId} status set to ${status} with message: ${message}`);
  } catch (error) {
    logger.error('Error setting custom status:', error);
    throw error;
  }
};

/**
 * Clean up inactive sessions
 * @param {number} inactiveMinutes - Minutes of inactivity before cleanup (default: 10)
 * @returns {Promise<number>}
 */
const cleanupInactiveSessions = async (inactiveMinutes = 10) => {
  try {
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000);
    
    // Find sessions that haven't pinged recently
    const inactiveSessions = await UserSession.findAll({
      where: {
        last_ping: { [Op.lt]: cutoffTime },
        is_active: true
      }
    });

    // Deactivate inactive sessions
    const deactivatedCount = await UserSession.update(
      { is_active: false },
      {
        where: {
          last_ping: { [Op.lt]: cutoffTime },
          is_active: true
        }
      }
    );

    // Update users who no longer have active sessions
    for (const session of inactiveSessions) {
      const activeSessions = await UserSession.count({
        where: { 
          user_id: session.user_id, 
          is_active: true 
        }
      });

      if (activeSessions === 0) {
        await User.update(
          { 
            online_status: 'offline',
            last_activity: session.last_ping
          },
          { where: { id: session.user_id } }
        );
      }
    }

    logger.info(`Cleaned up ${deactivatedCount} inactive sessions`);
    return deactivatedCount;
  } catch (error) {
    logger.error('Error cleaning up inactive sessions:', error);
    throw error;
  }
};

/**
 * Get users who are currently online with privacy controls
 * @param {object} filters - Filter options
 * @returns {Promise<User[]>}
 */
const getOnlineUsers = async (filters = {}) => {
  try {
    const whereClause = {
      online_status: 'online',
      active: true,
      show_online_status: true // Only show users who allow showing their status
    };

    if (filters.role) {
      whereClause.role = filters.role;
    }

    if (filters.city_id) {
      whereClause.city_id = filters.city_id;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: {
        exclude: ['password']
      },
      limit: filters.limit || 100,
      offset: filters.offset || 0
    });

    return users;
  } catch (error) {
    logger.error('Error getting online users:', error);
    throw error;
  }
};

/**
 * Helper function to convert time string to Date object
 * @param {string} timeString - Time string like '1h', '24h', '7d'
 * @returns {Date}
 */
const getTimeAgoDate = (timeString) => {
  const now = new Date();
  const value = parseInt(timeString);
  const unit = timeString.slice(-1);

  switch (unit) {
    case 'h':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'm':
      return new Date(now.getTime() - value * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
  }
};

/**
 * Update user's presence privacy settings
 * @param {string} userId - The user's ID
 * @param {object} settings - Privacy settings object
 * @returns {Promise<void>}
 */
const updatePresencePrivacySettings = async (userId, settings) => {
  try {
    const allowedSettings = ['show_online_status'];
    const updateData = {};

    // Validate and filter settings
    for (const [key, value] of Object.entries(settings)) {
      if (allowedSettings.includes(key)) {
        if (key === 'show_online_status' && typeof value !== 'boolean') {
          throw new Error('show_online_status must be a boolean value');
        }
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid privacy settings provided');
    }

    await User.update(updateData, { where: { id: userId } });

    logger.info(`User ${userId} privacy settings updated:`, updateData);
  } catch (error) {
    logger.error('Error updating presence privacy settings:', error);
    throw error;
  }
};

/**
 * Check if user can see another user's presence information
 * @param {string} targetUserId - The user whose presence is being requested
 * @param {string} requestingUserId - The user requesting the presence info
 * @returns {Promise<boolean>}
 */
const canViewPresence = async (targetUserId, requestingUserId = null) => {
  try {
    const targetUser = await User.findByPk(targetUserId, {
      attributes: ['show_online_status', 'online_status']
    });

    if (!targetUser) {
      return false;
    }

    // Users can always see their own presence
    if (targetUserId === requestingUserId) {
      return true;
    }

    // If user has disabled showing online status to others
    if (!targetUser.show_online_status) {
      return false;
    }

    // If user is in DND mode, they appear offline to others
    if (targetUser.online_status === 'dnd') {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking presence visibility:', error);
    return false;
  }
};

/**
 * Get filtered presence information based on privacy settings
 * @param {object} user - User object
 * @param {string} requestingUserId - The user requesting the presence info
 * @returns {object}
 */
const getFilteredPresenceInfo = (user, requestingUserId = null) => {
  const baseInfo = {
    userId: user.id,
    online_status: 'offline',
    last_seen: null,
    custom_message: null,
    show_status: user.show_online_status
  };

  // If user doesn't allow showing status
  if (!user.show_online_status) {
    return {
      ...baseInfo,
      last_seen_text: 'Last seen recently'
    };
  }

  // If user is in DND mode, show as offline
  if (user.online_status === 'dnd') {
    return {
      ...baseInfo,
      last_seen_text: 'Last seen recently'
    };
  }

  // If requesting own presence, show full info
  if (user.id === requestingUserId) {
    return {
      userId: user.id,
      online_status: user.online_status,
      last_seen: user.last_activity || user.last_seen,
      custom_message: user.custom_status_message,
      show_status: user.show_online_status,
      last_seen_text: user.getLastSeenText()
    };
  }

  // For other users, apply privacy filters
  const presenceInfo = {
    userId: user.id,
    online_status: user.online_status,
    custom_message: user.custom_status_message,
    show_status: user.show_online_status
  };

  // Hide exact timestamps if privacy is enabled
  if (!user.show_online_status) {
    presenceInfo.last_seen = null;
    presenceInfo.last_seen_text = 'Last seen recently';
  } else {
    presenceInfo.last_seen = user.last_activity || user.last_seen;
    presenceInfo.last_seen_text = user.getLastSeenText();
  }

  return presenceInfo;
};

module.exports = {
  setUserOnline,
  setUserOffline,
  updateLastActivity,
  getUserPresence,
  getOnlineProviders,
  setCustomStatus,
  cleanupInactiveSessions,
  getOnlineUsers,
  updatePresencePrivacySettings,
  canViewPresence,
  getFilteredPresenceInfo
};