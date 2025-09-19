/**
 * @fileoverview Controller for presence system maintenance and monitoring.
 * @module controllers/maintenance
 */

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const maintenanceService = require('../services/maintenance.service');
const scheduler = require('../utils/scheduler');
const logger = require('../utils/logger');

/**
 * Get current system metrics
 */
const getMetrics = catchAsync(async (req, res) => {
  const metrics = maintenanceService.getCurrentMetrics();
  
  res.status(httpStatus.OK).json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString()
  });
});

/**
 * Refresh and get updated system metrics
 */
const refreshMetrics = catchAsync(async (req, res) => {
  const metrics = await maintenanceService.collectSystemMetrics();
  
  res.status(httpStatus.OK).json({
    success: true,
    data: metrics,
    message: 'Metrics refreshed successfully'
  });
});

/**
 * Get detailed session information
 */
const getSessionDetails = catchAsync(async (req, res) => {
  const filters = {
    active: req.query.active !== undefined ? req.query.active : undefined,
    device_type: req.query.device_type,
    user_id: req.query.user_id,
    limit: parseInt(req.query.limit) || 100
  };

  const sessionDetails = await maintenanceService.getSessionDetails(filters);
  
  res.status(httpStatus.OK).json({
    success: true,
    data: sessionDetails,
    filters: filters
  });
});

/**
 * Perform system health check
 */
const healthCheck = catchAsync(async (req, res) => {
  const health = await maintenanceService.performHealthCheck();
  
  const statusCode = health.status === 'healthy' ? httpStatus.OK : 
                    health.status === 'warning' ? httpStatus.OK : 
                    httpStatus.INTERNAL_SERVER_ERROR;
  
  res.status(statusCode).json({
    success: health.status !== 'error',
    data: health
  });
});

/**
 * Manually trigger session cleanup
 */
const cleanupSessions = catchAsync(async (req, res) => {
  const inactiveMinutes = parseInt(req.body.inactiveMinutes) || 10;
  
  logger.info(`Manual session cleanup triggered by admin, inactiveMinutes: ${inactiveMinutes}`);
  
  const result = await maintenanceService.cleanupInactiveSessions(inactiveMinutes);
  
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
    message: `Cleaned up ${result.cleanedSessions} inactive sessions`
  });
});

/**
 * Manually trigger old data removal
 */
const removeOldData = catchAsync(async (req, res) => {
  const olderThanDays = parseInt(req.body.olderThanDays) || 7;
  
  logger.info(`Manual old data removal triggered by admin, olderThanDays: ${olderThanDays}`);
  
  const result = await maintenanceService.removeOldSessionData(olderThanDays);
  
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
    message: `Removed ${result.removedSessions} old sessions`
  });
});

/**
 * Get scheduler status
 */
const getSchedulerStatus = catchAsync(async (req, res) => {
  const status = scheduler.getStatus();
  
  res.status(httpStatus.OK).json({
    success: true,
    data: status
  });
});

/**
 * Manually trigger a scheduled task
 */
const triggerTask = catchAsync(async (req, res) => {
  const { taskName } = req.params;
  
  logger.info(`Manual task trigger requested: ${taskName}`);
  
  const result = await scheduler.triggerTask(taskName);
  
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
    message: `Task ${taskName} executed successfully`
  });
});

/**
 * Get maintenance configuration
 */
const getConfig = catchAsync(async (req, res) => {
  res.status(httpStatus.OK).json({
    success: true,
    data: maintenanceService.MAINTENANCE_CONFIG
  });
});

module.exports = {
  getMetrics,
  refreshMetrics,
  getSessionDetails,
  healthCheck,
  cleanupSessions,
  removeOldData,
  getSchedulerStatus,
  triggerTask,
  getConfig
};