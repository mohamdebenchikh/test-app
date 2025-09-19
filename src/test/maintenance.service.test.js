/**
 * @fileoverview Tests for maintenance service.
 * @module test/maintenance.service
 */

const { User, UserSession, sequelize } = require('../models');
const maintenanceService = require('../services/maintenance.service');
const logger = require('../utils/logger');

// Mock logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Maintenance Service', () => {
  beforeAll(async () => {
    // Sync database schema for tests
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up test data
    await UserSession.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    
    // Reset logger mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close database connection
    await sequelize.close();
  });

  describe('cleanupInactiveSessions', () => {
    it('should clean up inactive sessions and update user status', async () => {
      // Create test user
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'provider',
        online_status: 'online'
      });

      // Create inactive session (older than 10 minutes)
      const inactiveTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      await UserSession.create({
        user_id: user.id,
        socket_id: 'inactive-socket',
        device_type: 'web',
        connected_at: inactiveTime,
        last_ping: inactiveTime,
        is_active: true
      });

      // Run cleanup
      const result = await maintenanceService.cleanupInactiveSessions(10);

      // Verify results
      expect(result.cleanedSessions).toBe(1);
      expect(result.affectedUsers).toBe(1);

      // Verify session was deactivated
      const session = await UserSession.findOne({ where: { socket_id: 'inactive-socket' } });
      expect(session.is_active).toBe(false);

      // Verify user status was updated
      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser.online_status).toBe('offline');
    });

    it('should not affect users with other active sessions', async () => {
      // Create test user
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'provider',
        online_status: 'online'
      });

      // Create one inactive and one active session
      const inactiveTime = new Date(Date.now() - 15 * 60 * 1000);
      const activeTime = new Date(Date.now() - 2 * 60 * 1000);

      await UserSession.create({
        user_id: user.id,
        socket_id: 'inactive-socket',
        device_type: 'web',
        connected_at: inactiveTime,
        last_ping: inactiveTime,
        is_active: true
      });

      await UserSession.create({
        user_id: user.id,
        socket_id: 'active-socket',
        device_type: 'mobile',
        connected_at: activeTime,
        last_ping: activeTime,
        is_active: true
      });

      // Run cleanup
      const result = await maintenanceService.cleanupInactiveSessions(10);

      // Verify results
      expect(result.cleanedSessions).toBe(1);
      expect(result.affectedUsers).toBe(0); // User should remain online

      // Verify user status was not changed
      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser.online_status).toBe('online');
    });

    it('should handle no inactive sessions gracefully', async () => {
      const result = await maintenanceService.cleanupInactiveSessions(10);

      expect(result.cleanedSessions).toBe(0);
      expect(result.affectedUsers).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('No inactive sessions found for cleanup');
    });
  });

  describe('removeOldSessionData', () => {
    it('should remove old inactive sessions', async () => {
      // Create test user
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'provider'
      });

      // Create old inactive session
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const session = await UserSession.create({
        user_id: user.id,
        socket_id: 'old-socket',
        device_type: 'web',
        connected_at: oldDate,
        last_ping: oldDate,
        is_active: false,
        createdAt: oldDate
      });

      // Run cleanup
      const result = await maintenanceService.removeOldSessionData(7);

      // Verify results
      expect(result.removedSessions).toBe(1);

      // Verify session was removed
      const removedSession = await UserSession.findByPk(session.id);
      expect(removedSession).toBeNull();
    });

    it('should not remove active sessions', async () => {
      // Create test user
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'provider'
      });

      // Create old but active session
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const session = await UserSession.create({
        user_id: user.id,
        socket_id: 'old-active-socket',
        device_type: 'web',
        connected_at: oldDate,
        last_ping: new Date(),
        is_active: true,
        createdAt: oldDate
      });

      // Run cleanup
      const result = await maintenanceService.removeOldSessionData(7);

      // Verify results
      expect(result.removedSessions).toBe(0);

      // Verify session was not removed
      const existingSession = await UserSession.findByPk(session.id);
      expect(existingSession).not.toBeNull();
    });
  });

  describe('collectSystemMetrics', () => {
    it('should collect accurate system metrics', async () => {
      // Create test users
      const onlineUser = await User.create({
        name: 'Online User',
        email: 'online@example.com',
        password: 'hashedpassword',
        role: 'provider',
        online_status: 'online',
        active: true
      });

      const offlineUser = await User.create({
        name: 'Offline User',
        email: 'offline@example.com',
        password: 'hashedpassword',
        role: 'client',
        online_status: 'offline',
        active: true
      });

      // Create sessions
      await UserSession.create({
        user_id: onlineUser.id,
        socket_id: 'active-socket-1',
        device_type: 'web',
        is_active: true
      });

      await UserSession.create({
        user_id: onlineUser.id,
        socket_id: 'active-socket-2',
        device_type: 'mobile',
        is_active: true
      });

      await UserSession.create({
        user_id: offlineUser.id,
        socket_id: 'inactive-socket',
        device_type: 'web',
        is_active: false
      });

      // Collect metrics
      const metrics = await maintenanceService.collectSystemMetrics();

      // Verify metrics
      expect(metrics.totalActiveSessions).toBe(2);
      expect(metrics.totalInactiveSessions).toBe(1);
      expect(metrics.concurrentUsers).toBe(1); // Only one user has active sessions
      expect(metrics.onlineUsers).toBe(1);
      expect(metrics.totalUsers).toBe(2);
      expect(metrics.deviceDistribution).toEqual({
        web: 1,
        mobile: 1
      });
      expect(metrics.lastMetricsUpdate).toBeDefined();
    });
  });

  describe('getSessionDetails', () => {
    it('should return filtered session details', async () => {
      // Create test user
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'provider',
        online_status: 'online'
      });

      // Create sessions
      await UserSession.create({
        user_id: user.id,
        socket_id: 'web-socket',
        device_type: 'web',
        is_active: true
      });

      await UserSession.create({
        user_id: user.id,
        socket_id: 'mobile-socket',
        device_type: 'mobile',
        is_active: false
      });

      // Get active sessions only
      const activeDetails = await maintenanceService.getSessionDetails({ active: true });
      expect(activeDetails.sessions).toHaveLength(1);
      expect(activeDetails.sessions[0].device_type).toBe('web');

      // Get all sessions
      const allDetails = await maintenanceService.getSessionDetails({});
      expect(allDetails.sessions).toHaveLength(2);
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy status with no issues', async () => {
      const health = await maintenanceService.performHealthCheck();

      expect(health.status).toBe('healthy');
      expect(health.issues.staleSessions).toBe(0);
      expect(health.issues.inconsistentUsers).toBe(0);
      expect(health.recommendations).toHaveLength(0);
      expect(health.timestamp).toBeDefined();
      expect(health.executionTime).toBeGreaterThan(0);
    });

    it('should detect stale sessions', async () => {
      // Create user and stale session
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'provider',
        online_status: 'online'
      });

      const staleTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      await UserSession.create({
        user_id: user.id,
        socket_id: 'stale-socket',
        device_type: 'web',
        connected_at: staleTime,
        last_ping: staleTime,
        is_active: true
      });

      const health = await maintenanceService.performHealthCheck();

      expect(health.issues.staleSessions).toBe(1);
      expect(health.recommendations).toContain('1 stale sessions need cleanup');
    });
  });
});