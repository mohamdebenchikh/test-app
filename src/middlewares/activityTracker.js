/**
 * @fileoverview Activity tracking middleware for updating user presence.
 * @module middlewares/activityTracker
 */

const { presenceService } = require('../services');
const logger = require('../utils/logger');

// Rate limiting to prevent excessive database updates
const activityCache = new Map();
const ACTIVITY_UPDATE_INTERVAL = 30 * 1000; // 30 seconds

/**
 * Middleware to track user activity and update last_activity timestamp
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const trackActivity = async (req, res, next) => {
  // Only track activity for authenticated users
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;
  const now = Date.now();
  
  // Check if we recently updated this user's activity
  const lastUpdate = activityCache.get(userId);
  
  if (!lastUpdate || (now - lastUpdate) > ACTIVITY_UPDATE_INTERVAL) {
    try {
      // Update activity in background (don't block the request)
      presenceService.updateLastActivity(userId).then(() => {
        activityCache.set(userId, now);
        logger.debug(`Activity updated for user ${userId}`);
      }).catch((error) => {
        logger.error(`Error updating activity for user ${userId}:`, error);
      });
    } catch (error) {
      // Log error but don't block the request
      logger.error('Error in activity tracking middleware:', error);
    }
  }

  next();
};

/**
 * Middleware specifically for API endpoints that should always update activity
 * (bypasses rate limiting)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const forceTrackActivity = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;
  
  try {
    // Update activity immediately
    await presenceService.updateLastActivity(userId);
    activityCache.set(userId, Date.now());
    logger.debug(`Forced activity update for user ${userId}`);
  } catch (error) {
    logger.error(`Error in forced activity tracking for user ${userId}:`, error);
  }

  next();
};

/**
 * Clear activity cache for a specific user (useful for testing or cleanup)
 * @param {string} userId - User ID to clear from cache
 */
const clearActivityCache = (userId) => {
  if (userId) {
    activityCache.delete(userId);
  } else {
    activityCache.clear();
  }
};

/**
 * Get activity cache statistics (for monitoring)
 * @returns {object} Cache statistics
 */
const getActivityCacheStats = () => {
  return {
    size: activityCache.size,
    entries: Array.from(activityCache.entries()).map(([userId, timestamp]) => ({
      userId,
      lastUpdate: new Date(timestamp).toISOString()
    }))
  };
};

module.exports = {
  trackActivity,
  forceTrackActivity,
  clearActivityCache,
  getActivityCacheStats
};