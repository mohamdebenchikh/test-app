/**
 * @fileoverview Validation schemas for presence API endpoints.
 * @module validations/presence
 */

const { Joi } = require('celebrate');

/**
 * Validation schema for getting user presence
 */
const getUserPresence = {
  params: Joi.object().keys({
    userId: Joi.string().uuid().required()
  })
};

/**
 * Validation schema for updating user status with DND and Away support
 */
const updateStatus = {
  body: Joi.object().keys({
    status: Joi.string().valid('online', 'offline', 'away', 'dnd').required(),
    message: Joi.string().max(100).allow('', null).optional()
      .when('status', {
        is: Joi.string().valid('away', 'dnd'),
        then: Joi.string().max(100).allow('', null),
        otherwise: Joi.string().max(100).allow('', null).optional()
      })
  })
};

/**
 * Validation schema for updating presence settings
 */
const updatePresenceSettings = {
  body: Joi.object().keys({
    show_online_status: Joi.boolean().required()
  })
};

/**
 * Validation schema for getting online users
 */
const getOnlineUsers = {
  query: Joi.object().keys({
    role: Joi.string().valid('client', 'provider').optional(),
    city_id: Joi.string().uuid().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional()
  })
};

module.exports = {
  getUserPresence,
  updateStatus,
  updatePresenceSettings,
  getOnlineUsers
};