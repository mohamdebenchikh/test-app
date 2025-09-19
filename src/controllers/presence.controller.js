/**
 * @fileoverview Presence controller for handling user presence API requests.
 * @module controllers/presence
 */

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const { presenceService } = require('../services');

/**
 * Get user presence information with privacy controls
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getUserPresence = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const requestingUserId = req.user ? req.user.id : null;
  
  // Check if requesting user can view this presence
  const canView = await presenceService.canViewPresence(userId, requestingUserId);
  if (!canView) {
    return res.status(httpStatus.OK).json({
      userId: userId,
      online_status: 'offline',
      last_seen: null,
      custom_message: null,
      show_status: false,
      last_seen_text: 'Last seen recently'
    });
  }
  
  const presence = await presenceService.getUserPresence(userId, requestingUserId);
  res.status(httpStatus.OK).json(presence);
});

/**
 * Update current user's status
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updateStatus = catchAsync(async (req, res) => {
  const { status, message } = req.body;
  const userId = req.user.id;
  
  await presenceService.setCustomStatus(userId, status, message);
  
  res.status(httpStatus.OK).json({
    message: 'Status updated successfully',
    status: status,
    custom_message: message
  });
});

/**
 * Get current user's presence settings
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getPresenceSettings = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { User } = require('../models');
  
  const user = await User.findByPk(userId, {
    attributes: ['show_online_status', 'custom_status_message', 'online_status']
  });
  
  if (!user) {
    return res.status(httpStatus.NOT_FOUND).json({
      message: 'User not found'
    });
  }
  
  res.status(httpStatus.OK).json({
    show_online_status: user.show_online_status,
    custom_status_message: user.custom_status_message,
    online_status: user.online_status
  });
});

/**
 * Update current user's presence settings with validation
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updatePresenceSettings = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const settings = req.body;
  
  await presenceService.updatePresencePrivacySettings(userId, settings);
  
  res.status(httpStatus.OK).json({
    message: 'Presence settings updated successfully',
    settings
  });
});

/**
 * Get online users with optional filters and privacy controls
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getOnlineUsers = catchAsync(async (req, res) => {
  const { role, city_id, limit = 50, offset = 0 } = req.query;
  const requestingUserId = req.user.id;
  
  const filters = {
    role,
    city_id,
    limit: parseInt(limit),
    offset: parseInt(offset)
  };
  
  const users = await presenceService.getOnlineUsers(filters);
  
  // Add presence info to each user with privacy controls
  const usersWithPresence = users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    city_id: user.city_id,
    presence: user.getPresenceInfo(requestingUserId),
    last_seen_text: user.getLastSeenText(requestingUserId)
  }));
  
  res.status(httpStatus.OK).json({
    users: usersWithPresence,
    total: usersWithPresence.length
  });
});

/**
 * Update user's last activity (for manual activity tracking)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updateActivity = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  await presenceService.updateLastActivity(userId);
  
  res.status(httpStatus.OK).json({
    message: 'Activity updated successfully'
  });
});

module.exports = {
  getUserPresence,
  updateStatus,
  getPresenceSettings,
  updatePresenceSettings,
  getOnlineUsers,
  updateActivity
};