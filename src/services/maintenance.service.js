/**
 * @fileoverview Maintenance service for presence system cleanup and monitoring.
 * @module services/maintenance
 */

const { User, UserSession } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const presenceService = require('./presence.service');

/**
 * Configuration for maintenance tasks
 */
const MAINTENANCE_CONFIG = {
  // Session cleanup intervals
  INACTIVE_SESSION_MINUTES: 10,
  OLD_SESSION_CLEANUP_DAYS: 7,
  
  // Monitoring intervals
  METRICS_COLLECTION_INTERVAL: 5 * 60 * 1000, // 5 minutes
  SESSION_CLEANUP_INTERVAL: 2 * 60 * 1000,    // 2 minutes
  OLD_DATA_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  
  // Performance thresholds
  MAX_CONCURRENT_SESSIONS_WARNING: 1000,
  MAX_INACTIVE_SESSIONS_WARNING: 500,
};

/**
 * Metrics storage for monitoring
 */
let systemMetrics = {
  totalActiveSessions: 0,
  totalInactiveSessions: 0,
  concurrentUsers: 0,
  onlineUsers: 0,
  lastCleanupTime: null,
  lastMetricsUpdate: null,
  cleanupStats: {
    sessionsCleanedToday: 0,
    oldSessionsRemovedToday: 0,
    lastResetDate: new Date().toDateString()
  }
};

/**
 * Clean up inactive sessions and update user status
 * @param {number} inactiveMinutes - Minutes of inactivity before cleanup
 * @returns {Promise<object>} Cleanup statistics
 */
const cleanupInactiveSessions = async (inactiveMinutes = MAINTENANCE_CONFIG.INACTIVE_SESSION_MINUTES) => {
  try {
    const startTime = Date.now();
    const cutoffTime = new Date(Date.now() - inactiveMinutes * 60 * 1000);
    
    logger.info(`Starting inactive session cleanup for sessions older than ${inactiveMinutes} minutes`);
    
    // Find inactive sessions
    const inactiveSessions = await UserSession.findAll({
      where: {
        last_ping: { [Op.lt]: cutoffTime },
        is_active: true
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'online_status']
      }]
    });

    if (inactiveSessions.length === 0) {
      logger.info('No inactive sessions found for cleanup');
      return {
        cleanedSessions: 0,
        affectedUsers: 0,
        executionTime: Date.now() - startTime
      };
    }

    // Group sessions by user for efficient processing
    const userSessionMap = new Map();
    inactiveSessions.forEach(session => {
      if (!userSessionMap.has(session.user_id)) {
        userSessionMap.set(session.user_id, []);
      }
      userSessionMap.get(session.user_id).push(session);
    });

    // Deactivate inactive sessions
    const [deactivatedCount] = await UserSession.update(
      { is_active: false },
      {
        where: {
          last_ping: { [Op.lt]: cutoffTime },
          is_active: true
        }
      }
    );

    // Update user status for users with no remaining active sessions
    let affectedUsers = 0;
    for (const [userId, sessions] of userSessionMap) {
      const remainingActiveSessions = await UserSession.count({
        where: { 
          user_id: userId, 
          is_active: true 
        }
      });

      if (remainingActiveSessions === 0) {
        // Find the most recent session to use its last_ping as last_activity
        const mostRecentSession = sessions.reduce((latest, current) => 
          new Date(current.last_ping) > new Date(latest.last_ping) ? current : latest
        );

        await User.update(
          { 
            online_status: 'offline',
            last_activity: mostRecentSession.last_ping
          },
          { where: { id: userId } }
        );
        
        affectedUsers++;
      }
    }

    const executionTime = Date.now() - startTime;
    
    // Update metrics
    systemMetrics.lastCleanupTime = new Date();
    systemMetrics.cleanupStats.sessionsCleanedToday += deactivatedCount;
    
    // Reset daily counters if it's a new day
    const today = new Date().toDateString();
    if (systemMetrics.cleanupStats.lastResetDate !== today) {
      systemMetrics.cleanupStats.sessionsCleanedToday = deactivatedCount;
      systemMetrics.cleanupStats.oldSessionsRemovedToday = 0;
      systemMetrics.cleanupStats.lastResetDate = today;
    }

    const result = {
      cleanedSessions: deactivatedCount,
      affectedUsers,
      executionTime,
      cutoffTime: cutoffTime.toISOString()
    };

    logger.info(`Session cleanup completed: ${JSON.stringify(result)}`);
    return result;

  } catch (error) {
    logger.error('Error during inactive session cleanup:', error);
    throw error;
  }
};

/**
 * Remove old session data to prevent database bloat
 * @param {number} olderThanDays - Remove sessions older than this many days
 * @returns {Promise<object>} Removal statistics
 */
const removeOldSessionData = async (olderThanDays = MAINTENANCE_CONFIG.OLD_SESSION_CLEANUP_DAYS) => {
  try {
    const startTime = Date.now();
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    logger.info(`Starting old session data removal for sessions older than ${olderThanDays} days`);
    
    // Count sessions to be removed
    const sessionsToRemove = await UserSession.count({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        is_active: false
      }
    });

    if (sessionsToRemove === 0) {
      logger.info('No old sessions found for removal');
      return {
        removedSessions: 0,
        executionTime: Date.now() - startTime
      };
    }

    // Remove old inactive sessions
    const removedCount = await UserSession.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        is_active: false
      }
    });

    const executionTime = Date.now() - startTime;
    
    // Update metrics
    systemMetrics.cleanupStats.oldSessionsRemovedToday += removedCount;

    const result = {
      removedSessions: removedCount,
      executionTime,
      cutoffDate: cutoffDate.toISOString()
    };

    logger.info(`Old session data removal completed: ${JSON.stringify(result)}`);
    return result;

  } catch (error) {
    logger.error('Error during old session data removal:', error);
    throw error;
  }
};

/**
 * Collect system metrics for monitoring
 * @returns {Promise<object>} Current system metrics
 */
const collectSystemMetrics = async () => {
  try {
    const startTime = Date.now();
    
    // Get session statistics
    const [activeSessions, inactiveSessions, onlineUsers, totalUsers] = await Promise.all([
      UserSession.count({ where: { is_active: true } }),
      UserSession.count({ where: { is_active: false } }),
      User.count({ where: { online_status: { [Op.in]: ['online', 'away'] } } }),
      User.count({ where: { active: true } })
    ]);

    // Get concurrent users (users with active sessions)
    const concurrentUsers = await UserSession.count({
      where: { is_active: true },
      distinct: true,
      col: 'user_id'
    });

    // Get device type distribution
    const deviceStats = await UserSession.findAll({
      where: { is_active: true },
      attributes: [
        'device_type',
        [UserSession.sequelize.fn('COUNT', UserSession.sequelize.col('device_type')), 'count']
      ],
      group: ['device_type'],
      raw: true
    });

    // Update system metrics
    systemMetrics = {
      ...systemMetrics,
      totalActiveSessions: activeSessions,
      totalInactiveSessions: inactiveSessions,
      concurrentUsers,
      onlineUsers,
      totalUsers,
      lastMetricsUpdate: new Date(),
      deviceDistribution: deviceStats.reduce((acc, stat) => {
        acc[stat.device_type] = parseInt(stat.count);
        return acc;
      }, {}),
      executionTime: Date.now() - startTime
    };

    // Check for warning thresholds
    const warnings = [];
    if (activeSessions > MAINTENANCE_CONFIG.MAX_CONCURRENT_SESSIONS_WARNING) {
      warnings.push(`High concurrent sessions: ${activeSessions}`);
    }
    if (inactiveSessions > MAINTENANCE_CONFIG.MAX_INACTIVE_SESSIONS_WARNING) {
      warnings.push(`High inactive sessions: ${inactiveSessions}`);
    }

    if (warnings.length > 0) {
      logger.warn(`Presence system warnings: ${warnings.join(', ')}`);
    }

    logger.info(`System metrics collected: ${JSON.stringify({
      activeSessions,
      concurrentUsers,
      onlineUsers,
      executionTime: systemMetrics.executionTime
    })}`);

    return systemMetrics;

  } catch (error) {
    logger.error('Error collecting system metrics:', error);
    throw error;
  }
};

/**
 * Get current system metrics without recalculating
 * @returns {object} Current cached metrics
 */
const getCurrentMetrics = () => {
  return { ...systemMetrics };
};

/**
 * Get detailed session information for monitoring
 * @param {object} filters - Optional filters
 * @returns {Promise<object>} Detailed session information
 */
const getSessionDetails = async (filters = {}) => {
  try {
    const whereClause = {};
    
    if (filters.active !== undefined) {
      whereClause.is_active = filters.active;
    }
    
    if (filters.device_type) {
      whereClause.device_type = filters.device_type;
    }
    
    if (filters.user_id) {
      whereClause.user_id = filters.user_id;
    }

    const sessions = await UserSession.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'online_status', 'last_activity']
      }],
      order: [['last_ping', 'DESC']],
      limit: filters.limit || 100
    });

    return {
      sessions: sessions.map(session => ({
        id: session.id,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          online_status: session.user.online_status
        },
        device_type: session.device_type,
        connected_at: session.connected_at,
        last_ping: session.last_ping,
        is_active: session.is_active,
        session_duration: Date.now() - new Date(session.connected_at).getTime()
      })),
      total: sessions.length
    };

  } catch (error) {
    logger.error('Error getting session details:', error);
    throw error;
  }
};

/**
 * Perform comprehensive system health check
 * @returns {Promise<object>} Health check results
 */
const performHealthCheck = async () => {
  try {
    const startTime = Date.now();
    
    // Collect current metrics
    await collectSystemMetrics();
    
    // Check for stale sessions (sessions that should be cleaned up)
    const staleSessions = await UserSession.count({
      where: {
        last_ping: { 
          [Op.lt]: new Date(Date.now() - MAINTENANCE_CONFIG.INACTIVE_SESSION_MINUTES * 60 * 1000) 
        },
        is_active: true
      }
    });

    // Check for users with inconsistent status
    const inconsistentUsers = await User.count({
      where: {
        online_status: 'online',
        id: {
          [Op.notIn]: UserSession.sequelize.literal(`(
            SELECT DISTINCT user_id 
            FROM user_sessions 
            WHERE is_active = true
          )`)
        }
      }
    });

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      metrics: systemMetrics,
      issues: {
        staleSessions,
        inconsistentUsers
      },
      recommendations: [],
      executionTime: Date.now() - startTime
    };

    // Add recommendations based on findings
    if (staleSessions > 0) {
      healthStatus.recommendations.push(`${staleSessions} stale sessions need cleanup`);
    }
    
    if (inconsistentUsers > 0) {
      healthStatus.recommendations.push(`${inconsistentUsers} users have inconsistent online status`);
    }

    if (systemMetrics.totalActiveSessions > MAINTENANCE_CONFIG.MAX_CONCURRENT_SESSIONS_WARNING) {
      healthStatus.status = 'warning';
      healthStatus.recommendations.push('Consider scaling resources for high concurrent sessions');
    }

    logger.info(`Health check completed: ${healthStatus.status}, ${healthStatus.recommendations.length} recommendations`);
    return healthStatus;

  } catch (error) {
    logger.error('Error during health check:', error);
    return {
      status: 'error',
      timestamp: new Date(),
      error: error.message,
      executionTime: Date.now() - Date.now()
    };
  }
};

module.exports = {
  cleanupInactiveSessions,
  removeOldSessionData,
  collectSystemMetrics,
  getCurrentMetrics,
  getSessionDetails,
  performHealthCheck,
  MAINTENANCE_CONFIG
};