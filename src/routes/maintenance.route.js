/**
 * @fileoverview Routes for presence system maintenance and monitoring.
 * @module routes/maintenance
 */

const express = require('express');
const { celebrate, Joi, Segments } = require('celebrate');
const { auth } = require('../middlewares/auth');
const maintenanceController = require('../controllers/maintenance.controller');

const router = express.Router();

// All maintenance routes require authentication and admin role
router.use(auth('admin'));

/**
 * @route GET /api/maintenance/metrics
 * @desc Get current system metrics
 * @access Admin
 */
router.get('/metrics', maintenanceController.getMetrics);

/**
 * @route POST /api/maintenance/metrics/refresh
 * @desc Refresh and get updated system metrics
 * @access Admin
 */
router.post('/metrics/refresh', maintenanceController.refreshMetrics);

/**
 * @route GET /api/maintenance/sessions
 * @desc Get detailed session information
 * @access Admin
 */
router.get('/sessions', 
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      active: Joi.boolean(),
      device_type: Joi.string().valid('web', 'mobile', 'desktop'),
      user_id: Joi.string().uuid(),
      limit: Joi.number().integer().min(1).max(1000).default(100)
    })
  }),
  maintenanceController.getSessionDetails
);

/**
 * @route GET /api/maintenance/health
 * @desc Perform system health check
 * @access Admin
 */
router.get('/health', maintenanceController.healthCheck);

/**
 * @route POST /api/maintenance/cleanup/sessions
 * @desc Manually trigger session cleanup
 * @access Admin
 */
router.post('/cleanup/sessions',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      inactiveMinutes: Joi.number().integer().min(1).max(60).default(10)
    })
  }),
  maintenanceController.cleanupSessions
);

/**
 * @route POST /api/maintenance/cleanup/old-data
 * @desc Manually trigger old data removal
 * @access Admin
 */
router.post('/cleanup/old-data',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      olderThanDays: Joi.number().integer().min(1).max(365).default(7)
    })
  }),
  maintenanceController.removeOldData
);

/**
 * @route GET /api/maintenance/scheduler/status
 * @desc Get scheduler status
 * @access Admin
 */
router.get('/scheduler/status', maintenanceController.getSchedulerStatus);

/**
 * @route POST /api/maintenance/scheduler/trigger/:taskName
 * @desc Manually trigger a scheduled task
 * @access Admin
 */
router.post('/scheduler/trigger/:taskName',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      taskName: Joi.string().valid('sessionCleanup', 'metricsCollection', 'oldDataCleanup', 'healthCheck').required()
    })
  }),
  maintenanceController.triggerTask
);

/**
 * @route GET /api/maintenance/config
 * @desc Get maintenance configuration
 * @access Admin
 */
router.get('/config', maintenanceController.getConfig);

module.exports = router;