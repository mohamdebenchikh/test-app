const { sequelize, User, UserSession } = require('../models');
const { hashPassword } = require('../utils/password');
const presenceService = require('../services/presence.service');

describe('Socket Presence Service Integration', () => {
  let testUser;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test user
    const hashedPassword = await hashPassword('password123');
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'provider'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await UserSession.destroy({ where: {}, force: true });
    await User.update({ online_status: 'offline' }, { where: {} });
  });

  describe('Presence Service Integration', () => {
    test('should handle socket connection flow', async () => {
      const socketId = 'test-socket-123';
      const deviceInfo = {
        device_type: 'web',
        ip_address: '127.0.0.1',
        user_agent: 'Test Browser'
      };

      // Simulate socket connection
      await presenceService.setUserOnline(testUser.id, socketId, deviceInfo);
      
      // Check user is online
      await testUser.reload();
      expect(testUser.online_status).toBe('online');
      
      // Check session created
      const session = await UserSession.findOne({
        where: { user_id: testUser.id, socket_id: socketId }
      });
      expect(session).toBeTruthy();
      expect(session.is_active).toBe(true);
      
      // Simulate activity
      await presenceService.updateLastActivity(testUser.id);
      await testUser.reload();
      expect(testUser.last_activity).toBeTruthy();
      
      // Simulate custom status
      await presenceService.setCustomStatus(testUser.id, 'away', 'In a meeting');
      await testUser.reload();
      expect(testUser.online_status).toBe('away');
      expect(testUser.custom_status_message).toBe('In a meeting');
      
      // Simulate socket disconnection
      await presenceService.setUserOffline(testUser.id, socketId);
      await testUser.reload();
      expect(testUser.online_status).toBe('offline');
      
      // Check session deactivated
      await session.reload();
      expect(session.is_active).toBe(false);
    });

    test('should handle multiple device sessions', async () => {
      const socket1 = 'socket-1';
      const socket2 = 'socket-2';
      
      // Connect two devices
      await presenceService.setUserOnline(testUser.id, socket1, { device_type: 'web' });
      await presenceService.setUserOnline(testUser.id, socket2, { device_type: 'mobile' });
      
      // User should be online
      await testUser.reload();
      expect(testUser.online_status).toBe('online');
      
      // Should have two active sessions
      const sessionCount = await UserSession.count({
        where: { user_id: testUser.id, is_active: true }
      });
      expect(sessionCount).toBe(2);
      
      // Disconnect one device
      await presenceService.setUserOffline(testUser.id, socket1);
      
      // User should still be online (other session active)
      await testUser.reload();
      expect(testUser.online_status).toBe('online');
      
      // Disconnect second device
      await presenceService.setUserOffline(testUser.id, socket2);
      
      // Now user should be offline
      await testUser.reload();
      expect(testUser.online_status).toBe('offline');
    });

    test('should get user presence information', async () => {
      await presenceService.setUserOnline(testUser.id, 'socket-123');
      await presenceService.setCustomStatus(testUser.id, 'dnd', 'Do not disturb');
      
      const presence = await presenceService.getUserPresence(testUser.id);
      
      expect(presence.userId).toBe(testUser.id);
      expect(presence.online_status).toBe('dnd');
      expect(presence.custom_message).toBe('Do not disturb');
      expect(presence.show_status).toBe(true);
    });
  });
});