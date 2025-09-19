/**
 * @fileoverview Tests for task scheduler.
 * @module test/scheduler
 */

const scheduler = require('../utils/scheduler');
const maintenanceService = require('../services/maintenance.service');
const responseMetricsService = require('../services/responseMetrics.service');
const logger = require('../utils/logger');

// Mock dependencies
jest.mock('../services/maintenance.service');
jest.mock('../services/responseMetrics.service');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock timers
jest.useFakeTimers();

describe('Task Scheduler', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Stop scheduler if running
    if (scheduler.getStatus().isRunning) {
      scheduler.stop();
    }
  });

  afterEach(() => {
    // Clean up any running timers
    if (scheduler.getStatus().isRunning) {
      scheduler.stop();
    }
  });

  describe('start', () => {
    it('should start all scheduled tasks', () => {
      scheduler.start();
      
      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.activeTasks).toContain('sessionCleanup');
      expect(status.activeTasks).toContain('metricsCollection');
      expect(status.activeTasks).toContain('oldDataCleanup');
      expect(status.activeTasks).toContain('healthCheck');
      expect(status.activeTasks).toContain('responseMetricsUpdate');
      expect(status.activeTasks).toContain('responseMetricsCleanup');
      expect(status.taskCount).toBe(6);
      
      expect(logger.info).toHaveBeenCalledWith('Starting presence system maintenance scheduler');
      expect(logger.info).toHaveBeenCalledWith('All maintenance tasks scheduled successfully');
    });

    it('should not start if already running', () => {
      scheduler.start();
      scheduler.start(); // Try to start again
      
      expect(logger.warn).toHaveBeenCalledWith('Task scheduler is already running');
    });

    it('should execute tasks immediately on startup', () => {
      maintenanceService.cleanupInactiveSessions.mockResolvedValue({ cleanedSessions: 0 });
      maintenanceService.collectSystemMetrics.mockResolvedValue({ concurrentUsers: 0 });
      maintenanceService.removeOldSessionData.mockResolvedValue({ removedSessions: 0 });
      maintenanceService.performHealthCheck.mockResolvedValue({ status: 'healthy' });
      responseMetricsService.updateStaleProviderMetrics.mockResolvedValue({ updatedCount: 0 });
      responseMetricsService.cleanupOldMetrics.mockResolvedValue(0);

      scheduler.start();

      // Verify immediate execution
      expect(maintenanceService.cleanupInactiveSessions).toHaveBeenCalled();
      expect(maintenanceService.collectSystemMetrics).toHaveBeenCalled();
      expect(maintenanceService.removeOldSessionData).toHaveBeenCalled();
      expect(maintenanceService.performHealthCheck).toHaveBeenCalled();
      expect(responseMetricsService.updateStaleProviderMetrics).toHaveBeenCalled();
      expect(responseMetricsService.cleanupOldMetrics).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop all scheduled tasks', () => {
      scheduler.start();
      scheduler.stop();
      
      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.taskCount).toBe(0);
      
      expect(logger.info).toHaveBeenCalledWith('Stopping presence system maintenance scheduler');
      expect(logger.info).toHaveBeenCalledWith('All maintenance tasks stopped');
    });

    it('should not stop if not running', () => {
      scheduler.stop();
      
      expect(logger.warn).toHaveBeenCalledWith('Task scheduler is not running');
    });
  });

  describe('scheduled task execution', () => {
    beforeEach(() => {
      // Mock maintenance service methods
      maintenanceService.cleanupInactiveSessions.mockResolvedValue({ cleanedSessions: 2 });
      maintenanceService.collectSystemMetrics.mockResolvedValue({ concurrentUsers: 5 });
      maintenanceService.removeOldSessionData.mockResolvedValue({ removedSessions: 1 });
      maintenanceService.performHealthCheck.mockResolvedValue({ status: 'healthy' });
      responseMetricsService.updateStaleProviderMetrics.mockResolvedValue({ updatedCount: 3, errorCount: 0 });
      responseMetricsService.cleanupOldMetrics.mockResolvedValue(5);
    });

    it('should execute session cleanup on schedule', async () => {
      scheduler.start();
      
      // Fast-forward time to trigger session cleanup (2 minutes)
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(maintenanceService.cleanupInactiveSessions).toHaveBeenCalledTimes(2); // Initial + scheduled
      expect(logger.info).toHaveBeenCalledWith('Scheduled cleanup: 2 sessions cleaned, undefined users updated');
    });

    it('should execute metrics collection on schedule', async () => {
      scheduler.start();
      
      // Fast-forward time to trigger metrics collection (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(maintenanceService.collectSystemMetrics).toHaveBeenCalledTimes(2); // Initial + scheduled
      expect(logger.info).toHaveBeenCalledWith('Metrics collected: 5 concurrent users, undefined active sessions');
    });

    it('should execute response metrics update on schedule', async () => {
      scheduler.start();
      
      // Fast-forward time to trigger response metrics update (2 hours)
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(responseMetricsService.updateStaleProviderMetrics).toHaveBeenCalledTimes(2); // Initial + scheduled
      expect(logger.info).toHaveBeenCalledWith('Scheduled response metrics update: 3 providers updated, 0 errors');
    });

    it('should execute response metrics cleanup on schedule', async () => {
      scheduler.start();
      
      // Fast-forward time to trigger response metrics cleanup (24 hours)
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(responseMetricsService.cleanupOldMetrics).toHaveBeenCalledTimes(2); // Initial + scheduled
      expect(logger.info).toHaveBeenCalledWith('Scheduled response metrics cleanup: 5 old records removed');
    });

    it('should handle task errors gracefully', async () => {
      maintenanceService.cleanupInactiveSessions.mockRejectedValue(new Error('Database error'));
      
      scheduler.start();
      
      // Fast-forward time to trigger session cleanup
      jest.advanceTimersByTime(2 * 60 * 1000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(logger.error).toHaveBeenCalledWith('Scheduled session cleanup failed:', expect.any(Error));
    });

    it('should handle response metrics task errors gracefully', async () => {
      responseMetricsService.updateStaleProviderMetrics.mockRejectedValue(new Error('Metrics error'));
      
      scheduler.start();
      
      // Fast-forward time to trigger response metrics update
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(logger.error).toHaveBeenCalledWith('Scheduled response metrics update failed:', expect.any(Error));
    });
  });

  describe('triggerTask', () => {
    beforeEach(() => {
      maintenanceService.cleanupInactiveSessions.mockResolvedValue({ cleanedSessions: 3 });
      maintenanceService.collectSystemMetrics.mockResolvedValue({ concurrentUsers: 10 });
      maintenanceService.removeOldSessionData.mockResolvedValue({ removedSessions: 5 });
      maintenanceService.performHealthCheck.mockResolvedValue({ status: 'warning' });
      responseMetricsService.updateStaleProviderMetrics.mockResolvedValue({ updatedCount: 2, errorCount: 1 });
      responseMetricsService.cleanupOldMetrics.mockResolvedValue(10);
    });

    it('should manually trigger sessionCleanup', async () => {
      const result = await scheduler.triggerTask('sessionCleanup');
      
      expect(result).toEqual({ cleanedSessions: 3 });
      expect(maintenanceService.cleanupInactiveSessions).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Manually triggering task: sessionCleanup');
    });

    it('should manually trigger metricsCollection', async () => {
      const result = await scheduler.triggerTask('metricsCollection');
      
      expect(result).toEqual({ concurrentUsers: 10 });
      expect(maintenanceService.collectSystemMetrics).toHaveBeenCalled();
    });

    it('should manually trigger oldDataCleanup', async () => {
      const result = await scheduler.triggerTask('oldDataCleanup');
      
      expect(result).toEqual({ removedSessions: 5 });
      expect(maintenanceService.removeOldSessionData).toHaveBeenCalled();
    });

    it('should manually trigger healthCheck', async () => {
      const result = await scheduler.triggerTask('healthCheck');
      
      expect(result).toEqual({ status: 'warning' });
      expect(maintenanceService.performHealthCheck).toHaveBeenCalled();
    });

    it('should manually trigger responseMetricsUpdate', async () => {
      const result = await scheduler.triggerTask('responseMetricsUpdate');
      
      expect(result).toEqual({ updatedCount: 2, errorCount: 1 });
      expect(responseMetricsService.updateStaleProviderMetrics).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Manually triggering task: responseMetricsUpdate');
    });

    it('should manually trigger responseMetricsCleanup', async () => {
      const result = await scheduler.triggerTask('responseMetricsCleanup');
      
      expect(result).toBe(10);
      expect(responseMetricsService.cleanupOldMetrics).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Manually triggering task: responseMetricsCleanup');
    });

    it('should throw error for unknown task', async () => {
      await expect(scheduler.triggerTask('unknownTask')).rejects.toThrow('Unknown task: unknownTask');
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not running', () => {
      const status = scheduler.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.activeTasks).toEqual([]);
      expect(status.taskCount).toBe(0);
    });

    it('should return correct status when running', () => {
      scheduler.start();
      const status = scheduler.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.activeTasks).toHaveLength(6);
      expect(status.taskCount).toBe(6);
    });
  });
});