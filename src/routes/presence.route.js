/**
 * @fileoverview Presence routes for user presence management.
 * @module routes/presence
 */

const express = require('express');
const { celebrate } = require('celebrate');
const { authenticate } = require('../middlewares/auth');
const { forceTrackActivity } = require('../middlewares/activityTracker');
const presenceController = require('../controllers/presence.controller');
const presenceValidation = require('../validations/presence.validation');

const router = express.Router();

/**
 * @route GET /api/presence/users/:userId
 * @desc Get user presence information
 * @access Public (respects privacy settings)
 */
router.get(
  '/users/:userId',
  celebrate(presenceValidation.getUserPresence),
  presenceController.getUserPresence
);

/**
 * @route PATCH /api/presence/status
 * @desc Update current user's status
 * @access Private
 */
router.patch(
  '/status',
  authenticate,
  celebrate(presenceValidation.updateStatus),
  presenceController.updateStatus
);

/**
 * @route GET /api/presence/settings
 * @desc Get current user's presence settings
 * @access Private
 */
router.get(
  '/settings',
  authenticate,
  presenceController.getPresenceSettings
);

/**
 * @route PATCH /api/presence/settings
 * @desc Update current user's presence settings
 * @access Private
 */
router.patch(
  '/settings',
  authenticate,
  celebrate(presenceValidation.updatePresenceSettings),
  presenceController.updatePresenceSettings
);

/**
 * @route GET /api/presence/online
 * @desc Get online users with optional filters
 * @access Private
 */
router.get(
  '/online',
  authenticate,
  celebrate(presenceValidation.getOnlineUsers),
  presenceController.getOnlineUsers
);

/**
 * @route POST /api/presence/activity
 * @desc Update user's last activity
 * @access Private
 */
router.post(
  '/activity',
  authenticate,
  forceTrackActivity,
  presenceController.updateActivity
);

module.exports = router;