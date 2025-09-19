/**
 * @fileoverview Task scheduler for presence system maintenance.
 * @module utils/scheduler
 */

const logger = require('./logger');
const maintenanceService = require('../services/maintenance.service');
const responseMetricsService = require('../services/responseMetrics.service');

/**
 * Scheduled task manager for presence system maintenance
 */
class TaskScheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled maintenance tasks
   */
  start() {
    if (this.isRunning) {
      logger.warn('Task scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting presence system maintenance scheduler');

    // Schedule inactive session cleanup (every 2 minutes)
    this.scheduleTask('sessionCleanup', async () => {
      try {
        const result = await maintenanceService.cleanupInactiveSessions();
        if (result.cleanedSessions > 0) {
          logger.info(`Scheduled cleanup: ${result.cleanedSessions} sessions cleaned, ${result.affectedUsers} users updated`);
        }
      } catch (error) {
        logger.error('Scheduled session cleanup failed:', error);
      }
    }, maintenanceService.MAINTENANCE_CONFIG.SESSION_CLEANUP_INTERVAL);

    // Schedule metrics collection (every 5 minutes)
    this.scheduleTask('metricsCollection', async () => {
      try {
        const metrics = await maintenanceService.collectSystemMetrics();
        logger.info(`Metrics collected: ${metrics.concurrentUsers} concurrent users, ${metrics.totalActiveSessions} active sessions`);
      } catch (error) {
        logger.error('Scheduled metrics collection failed:', error);
      }
    }, maintenanceService.MAINTENANCE_CONFIG.METRICS_COLLECTION_INTERVAL);

    // Schedule old data cleanup (every 24 hours)
    this.scheduleTask('oldDataCleanup', async () => {
      try {
        const result = await maintenanceService.removeOldSessionData();
        if (result.removedSessions > 0) {
          logger.info(`Scheduled old data cleanup: ${result.removedSessions} old sessions removed`);
        }
      } catch (error) {
        logger.error('Scheduled old data cleanup failed:', error);
      }
    }, maintenanceService.MAINTENANCE_CONFIG.OLD_DATA_CLEANUP_INTERVAL);

    // Schedule health check (every 30 minutes)
    this.scheduleTask('healthCheck', async () => {
      try {
        const health = await maintenanceService.performHealthCheck();
        if (health.status !== 'healthy') {
          logger.warn(`Health check status: ${health.status}`, {
            recommendations: health.recommendations,
            issues: health.issues
          });
        }
      } catch (error) {
        logger.error('Scheduled health check failed:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Schedule response metrics update (every 2 hours)
    this.scheduleTask('responseMetricsUpdate', async () => {
      try {
        const result = await responseMetricsService.updateStaleProviderMetrics();
        if (result.updatedCount > 0) {
          logger.info(`Scheduled response metrics update: ${result.updatedCount} providers updated, ${result.errorCount} errors`);
        }
      } catch (error) {
        logger.error('Scheduled response metrics update failed:', error);
      }
    }, 2 * 60 * 60 * 1000); // 2 hours

    // Schedule response metrics cleanup (every 24 hours)
    this.scheduleTask('responseMetricsCleanup', async () => {
      try {
        const result = await responseMetricsService.cleanupOldMetrics();
        if (result.deletedCount > 0) {
          logger.info(`Scheduled response metrics cleanup: ${result.deletedCount} old records removed`);
        }
      } catch (error) {
        logger.error('Scheduled response metrics cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Schedule response metrics data integrity validation (every 7 days)
    this.scheduleTask('responseMetricsValidation', async () => {
      try {
        const result = await responseMetricsService.validateDataIntegrity();
        if (!result.isValid) {
          logger.warn(`Response metrics data integrity issues found: ${result.issues.length} issues, ${result.fixedCount} fixes applied`);
        } else {
          logger.info('Response metrics data integrity validation passed');
        }
      } catch (error) {
        logger.error('Scheduled response metrics validation failed:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days

    logger.info('All maintenance tasks scheduled successfully');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Task scheduler is not running');
      return;
    }

    logger.info('Stopping presence system maintenance scheduler');
    
    for (const [taskName, intervalId] of this.tasks) {
      clearInterval(intervalId);
      logger.info(`Stopped scheduled task: ${taskName}`);
    }
    
    this.tasks.clear();
    this.isRunning = false;
    
    logger.info('All maintenance tasks stopped');
  }

  /**
   * Schedule a recurring task
   * @param {string} name - Task name
   * @param {Function} task - Task function to execute
   * @param {number} interval - Interval in milliseconds
   */
  scheduleTask(name, task, interval) {
    if (this.tasks.has(name)) {
      logger.warn(`Task ${name} is already scheduled`);
      return;
    }

    // Execute task immediately on startup
    task().catch(error => {
      logger.error(`Initial execution of task ${name} failed:`, error);
    });

    // Schedule recurring execution
    const intervalId = setInterval(async () => {
      try {
        await task();
      } catch (error) {
        logger.error(`Scheduled task ${name} failed:`, error);
      }
    }, interval);

    this.tasks.set(name, intervalId);
    logger.info(`Scheduled task: ${name} (interval: ${interval}ms)`);
  }

  /**
   * Get status of all scheduled tasks
   * @returns {object} Task status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      taskCount: this.tasks.size
    };
  }

  /**
   * Manually trigger a specific maintenance task
   * @param {string} taskName - Name of the task to trigger
   * @returns {Promise<any>} Task result
   */
  async triggerTask(taskName) {
    logger.info(`Manually triggering task: ${taskName}`);
    
    switch (taskName) {
      case 'sessionCleanup':
        return await maintenanceService.cleanupInactiveSessions();
      
      case 'metricsCollection':
        return await maintenanceService.collectSystemMetrics();
      
      case 'oldDataCleanup':
        return await maintenanceService.removeOldSessionData();
      
      case 'healthCheck':
        return await maintenanceService.performHealthCheck();
      
      case 'responseMetricsUpdate':
        return await responseMetricsService.updateStaleProviderMetrics();
      
      case 'responseMetricsCleanup':
        return await responseMetricsService.cleanupOldMetrics();
      
      case 'responseMetricsValidation':
        return await responseMetricsService.validateDataIntegrity();
      
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }
  }
}

// Create singleton instance
const scheduler = new TaskScheduler();

module.exports = scheduler;