const { sequelize, User, UserSession } = require('../models');
const presenceService = require('../services/presence.service');
const { hashPassword } = require('../utils/password');

describe('Presence Service', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await UserSession.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  });

  describe('setUserOnline', () => {
    test('should set user online and create session', async () => {
      // Create test user
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      const deviceInfo = {
        device_type: 'web',
        ip_address: '127.0.0.1',
        user_agent: 'Test Browser'
      };

      const session = await presenceService.setUserOnline(user.id, 'socket123', deviceInfo);

      // Check user status updated
      await user.reload();
      expect(user.online_status).toBe('online');
      expect(user.last_activity).toBeTruthy();

      // Check session created
      expect(session.user_id).toBe(user.id);
      expect(session.socket_id).toBe('socket123');
      expect(session.device_type).toBe('web');
      expect(session.is_active).toBe(true);
    });

    test('should update existing session if socket already exists', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      // Create initial session
      await presenceService.setUserOnline(user.id, 'socket123', { device_type: 'web' });
      
      // Update same socket
      const updatedSession = await presenceService.setUserOnline(user.id, 'socket123', { device_type: 'mobile' });

      // Should have only one session
      const sessionCount = await UserSession.count({ where: { user_id: user.id } });
      expect(sessionCount).toBe(1);
      expect(updatedSession.device_type).toBe('mobile');
    });
  });

  describe('setUserOffline', () => {
    test('should set user offline when no other active sessions', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      // Set user online first
      await presenceService.setUserOnline(user.id, 'socket123');
      
      // Set user offline
      await presenceService.setUserOffline(user.id, 'socket123');

      // Check user status
      await user.reload();
      expect(user.online_status).toBe('offline');

      // Check session deactivated
      const session = await UserSession.findOne({ where: { socket_id: 'socket123' } });
      expect(session.is_active).toBe(false);
    });

    test('should keep user online if other active sessions exist', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      // Create two sessions
      await presenceService.setUserOnline(user.id, 'socket123');
      await presenceService.setUserOnline(user.id, 'socket456');
      
      // Disconnect one session
      await presenceService.setUserOffline(user.id, 'socket123');

      // User should still be online
      await user.reload();
      expect(user.online_status).toBe('online');
    });
  });

  describe('updateLastActivity', () => {
    test('should update user last activity and session ping', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      await presenceService.setUserOnline(user.id, 'socket123');
      
      await user.reload();
      const oldActivity = user.last_activity;
      
      // Wait a bit and update activity
      await new Promise(resolve => setTimeout(resolve, 10));
      await presenceService.updateLastActivity(user.id);

      await user.reload();
      expect(user.last_activity.getTime()).toBeGreaterThan(oldActivity.getTime());
    });
  });

  describe('getUserPresence', () => {
    test('should return user presence information', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider',
        online_status: 'online',
        custom_status_message: 'Available for work'
      });

      const presence = await presenceService.getUserPresence(user.id);

      expect(presence.userId).toBe(user.id);
      expect(presence.online_status).toBe('online');
      expect(presence.custom_message).toBe('Available for work');
      expect(presence.show_status).toBe(true);
    });

    test('should throw error for non-existent user', async () => {
      await expect(presenceService.getUserPresence('non-existent-id'))
        .rejects.toThrow('User not found');
    });
  });

  describe('setCustomStatus', () => {
    test('should update user status and message', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      await presenceService.setCustomStatus(user.id, 'away', 'In a meeting');

      await user.reload();
      expect(user.online_status).toBe('away');
      expect(user.custom_status_message).toBe('In a meeting');
    });

    test('should throw error for invalid status', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      await expect(presenceService.setCustomStatus(user.id, 'invalid', 'message'))
        .rejects.toThrow('Invalid status');
    });
  });

  describe('cleanupInactiveSessions', () => {
    test('should deactivate old sessions and set users offline', async () => {
      const hashedPassword = await hashPassword('password123');
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        role: 'provider'
      });

      // Create session with old timestamp
      const oldTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      await UserSession.create({
        user_id: user.id,
        socket_id: 'socket123',
        device_type: 'web',
        connected_at: oldTime,
        last_ping: oldTime,
        is_active: true
      });

      await User.update({ online_status: 'online' }, { where: { id: user.id } });

      // Cleanup sessions older than 10 minutes
      const cleanedCount = await presenceService.cleanupInactiveSessions(10);

      expect(cleanedCount[0]).toBe(1);

      // Check session deactivated
      const session = await UserSession.findOne({ where: { socket_id: 'socket123' } });
      expect(session.is_active).toBe(false);

      // Check user set offline
      await user.reload();
      expect(user.online_status).toBe('offline');
    });
  });
});