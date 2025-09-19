/**
 * @fileoverview Tests for presence privacy controls.
 * @module test/presence.privacy
 */

const { User, UserSession, sequelize } = require('../models');
const presenceService = require('../services/presence.service');

describe('Presence Privacy Controls', () => {
  let testUser1, testUser2, testUser3;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Create test users
    testUser1 = await User.create({
      name: 'Test User 1',
      email: 'test1@example.com',
      password: 'hashedpassword',
      role: 'provider',
      show_online_status: true,
      online_status: 'online'
    });

    testUser2 = await User.create({
      name: 'Test User 2',
      email: 'test2@example.com',
      password: 'hashedpassword',
      role: 'client',
      show_online_status: false, // Privacy enabled
      online_status: 'online'
    });

    testUser3 = await User.create({
      name: 'Test User 3',
      email: 'test3@example.com',
      password: 'hashedpassword',
      role: 'provider',
      show_online_status: true,
      online_status: 'dnd',
      custom_status_message: 'In a meeting'
    });
  });

  afterEach(async () => {
    await UserSession.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Privacy Settings Validation', () => {
    test('should update privacy settings successfully', async () => {
      const settings = { show_online_status: false };
      
      await presenceService.updatePresencePrivacySettings(testUser1.id, settings);
      
      const updatedUser = await User.findByPk(testUser1.id);
      expect(updatedUser.show_online_status).toBe(false);
    });

    test('should reject invalid privacy settings', async () => {
      const settings = { invalid_setting: true };
      
      await expect(
        presenceService.updatePresencePrivacySettings(testUser1.id, settings)
      ).rejects.toThrow('No valid privacy settings provided');
    });

    test('should validate show_online_status as boolean', async () => {
      const settings = { show_online_status: 'invalid' };
      
      await expect(
        presenceService.updatePresencePrivacySettings(testUser1.id, settings)
      ).rejects.toThrow('show_online_status must be a boolean value');
    });
  });

  describe('Presence Visibility Controls', () => {
    test('should allow viewing own presence regardless of privacy settings', async () => {
      const canView = await presenceService.canViewPresence(testUser2.id, testUser2.id);
      expect(canView).toBe(true);
    });

    test('should deny viewing presence when privacy is disabled', async () => {
      const canView = await presenceService.canViewPresence(testUser2.id, testUser1.id);
      expect(canView).toBe(false);
    });

    test('should allow viewing presence when privacy is enabled', async () => {
      const canView = await presenceService.canViewPresence(testUser1.id, testUser2.id);
      expect(canView).toBe(true);
    });

    test('should deny viewing presence for DND users', async () => {
      const canView = await presenceService.canViewPresence(testUser3.id, testUser1.id);
      expect(canView).toBe(false);
    });
  });

  describe('Timestamp Hiding Logic', () => {
    test('should hide exact timestamps when privacy is disabled', async () => {
      const presence = await presenceService.getUserPresence(testUser2.id, testUser1.id);
      
      expect(presence.last_seen_text).toBe('Last seen recently');
      expect(presence.last_seen).toBeNull();
    });

    test('should show exact timestamps to the user themselves', async () => {
      const presence = await presenceService.getUserPresence(testUser2.id, testUser2.id);
      
      expect(presence.last_seen_text).not.toBe('Last seen recently');
      expect(presence.last_seen).not.toBeNull();
    });

    test('should show exact timestamps when privacy allows it', async () => {
      const presence = await presenceService.getUserPresence(testUser1.id, testUser2.id);
      
      expect(presence.last_seen_text).not.toBe('Last seen recently');
      expect(presence.show_status).toBe(true);
    });
  });

  describe('Do Not Disturb Status Handling', () => {
    test('should set DND status correctly', async () => {
      await presenceService.setCustomStatus(testUser1.id, 'dnd', 'In a meeting');
      
      const updatedUser = await User.findByPk(testUser1.id);
      expect(updatedUser.online_status).toBe('dnd');
      expect(updatedUser.custom_status_message).toBe('In a meeting');
    });

    test('should make DND users appear offline to others', async () => {
      const presence = await presenceService.getUserPresence(testUser3.id, testUser1.id);
      
      expect(presence.online_status).toBe('offline');
      expect(presence.last_seen_text).toBe('Last seen recently');
    });

    test('should show DND status to the user themselves', async () => {
      const presence = await presenceService.getUserPresence(testUser3.id, testUser3.id);
      
      expect(presence.online_status).toBe('dnd');
      expect(presence.custom_message).toBe('In a meeting');
    });

    test('should exclude DND users from online provider lists', async () => {
      // Create a DND provider user
      const dndProvider = await User.create({
        name: 'DND Provider',
        email: 'dnd@example.com',
        password: 'hashedpassword',
        role: 'provider',
        show_online_status: true,
        online_status: 'dnd',
        city_id: 'test-city-id'
      });
      
      const providers = await presenceService.getOnlineProviders('test-city-id', null, {
        online_status: 'online'
      });
      
      const foundDndProvider = providers.find(p => p.id === dndProvider.id);
      expect(foundDndProvider).toBeUndefined();
    });
  });

  describe('Away Status Handling', () => {
    test('should set Away status correctly', async () => {
      await presenceService.setCustomStatus(testUser1.id, 'away', 'At lunch');
      
      const updatedUser = await User.findByPk(testUser1.id);
      expect(updatedUser.online_status).toBe('away');
      expect(updatedUser.custom_status_message).toBe('At lunch');
      expect(updatedUser.show_online_status).toBe(true);
    });

    test('should show Away status with custom message', async () => {
      await presenceService.setCustomStatus(testUser1.id, 'away', 'At lunch');
      
      // Refresh user from database to get updated status
      await testUser1.reload();
      const lastSeenText = testUser1.getLastSeenText();
      expect(lastSeenText).toBe('Away - At lunch');
    });

    test('should show generic Away status without custom message', async () => {
      await presenceService.setCustomStatus(testUser1.id, 'away');
      
      await testUser1.reload();
      const lastSeenText = testUser1.getLastSeenText();
      expect(lastSeenText).toBe('Away');
    });
  });

  describe('Custom Status Message Validation', () => {
    test('should accept valid custom status messages', async () => {
      const message = 'Working on important project';
      
      await expect(
        presenceService.setCustomStatus(testUser1.id, 'away', message)
      ).resolves.not.toThrow();
    });

    test('should reject custom status messages over 100 characters', async () => {
      const longMessage = 'a'.repeat(101);
      
      await expect(
        presenceService.setCustomStatus(testUser1.id, 'away', longMessage)
      ).rejects.toThrow('Custom status message cannot exceed 100 characters');
    });

    test('should accept empty custom status messages', async () => {
      await expect(
        presenceService.setCustomStatus(testUser1.id, 'away', '')
      ).resolves.not.toThrow();
    });

    test('should accept null custom status messages', async () => {
      await expect(
        presenceService.setCustomStatus(testUser1.id, 'away', null)
      ).resolves.not.toThrow();
    });
  });

  describe('Filtered Presence Information', () => {
    test('should return filtered presence info for privacy-disabled users', async () => {
      const filteredInfo = presenceService.getFilteredPresenceInfo(testUser2, testUser1.id);
      
      expect(filteredInfo.last_seen_text).toBe('Last seen recently');
      expect(filteredInfo.last_seen).toBeNull();
      expect(filteredInfo.show_status).toBe(false);
    });

    test('should return full presence info for own requests', async () => {
      const filteredInfo = presenceService.getFilteredPresenceInfo(testUser2, testUser2.id);
      
      expect(filteredInfo.online_status).toBe('online');
      expect(filteredInfo.show_status).toBe(false);
      expect(filteredInfo.last_seen).not.toBeNull();
    });

    test('should return filtered info for DND users', async () => {
      const filteredInfo = presenceService.getFilteredPresenceInfo(testUser3, testUser1.id);
      
      expect(filteredInfo.online_status).toBe('offline');
      expect(filteredInfo.last_seen_text).toBe('Last seen recently');
    });
  });

  describe('Online Users List Privacy', () => {
    test('should exclude privacy-disabled users from online lists', async () => {
      const onlineUsers = await presenceService.getOnlineUsers();
      
      const privateUser = onlineUsers.find(u => u.id === testUser2.id);
      expect(privateUser).toBeUndefined();
    });

    test('should include privacy-enabled users in online lists', async () => {
      const onlineUsers = await presenceService.getOnlineUsers();
      
      const publicUser = onlineUsers.find(u => u.id === testUser1.id);
      expect(publicUser).toBeDefined();
    });

    test('should exclude DND users from online lists', async () => {
      const onlineUsers = await presenceService.getOnlineUsers();
      
      const dndUser = onlineUsers.find(u => u.id === testUser3.id);
      expect(dndUser).toBeUndefined();
    });
  });
});