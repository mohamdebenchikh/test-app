/**
 * @fileoverview Tests for presence broadcasting utilities
 */

const { 
  getRelevantUsersForPresence,
  getProvidersInSameCity,
  broadcastPresenceUpdate,
  broadcastTypingIndicator,
  broadcastStatusChange,
  broadcastCustomStatus
} = require('../src/utils/presenceBroadcast');

const { User, Conversation, UserSession } = require('../src/models');
const logger = require('../src/utils/logger');

// Mock the models and logger
jest.mock('../src/models');
jest.mock('../src/utils/logger');

describe('Presence Broadcasting Utilities', () => {
  let mockIo;

  beforeEach(() => {
    // Mock Socket.IO instance
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getRelevantUsersForPresence', () => {
    it('should return users from conversations', async () => {
      const userId = 'user1';
      const mockConversations = [
        { userOneId: userId, userTwoId: 'user2' },
        { userOneId: 'user3', userTwoId: userId }
      ];

      Conversation.findAll.mockResolvedValue(mockConversations);

      const result = await getRelevantUsersForPresence(userId);

      expect(result).toEqual(['user2', 'user3']);
      expect(Conversation.findAll).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const userId = 'user1';
      Conversation.findAll.mockRejectedValue(new Error('Database error'));

      const result = await getRelevantUsersForPresence(userId);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('Error getting relevant users for presence:', expect.any(Error));
    });
  });

  describe('getProvidersInSameCity', () => {
    it('should return providers in same city for client', async () => {
      const userId = 'client1';
      const mockUser = { city_id: 'city1', role: 'client' };
      const mockProviders = [
        { id: 'provider1' },
        { id: 'provider2' }
      ];

      User.findByPk.mockResolvedValue(mockUser);
      User.findAll.mockResolvedValue(mockProviders);

      const result = await getProvidersInSameCity(userId);

      expect(result).toEqual(['provider1', 'provider2']);
      expect(User.findByPk).toHaveBeenCalledWith(userId, { attributes: ['city_id', 'role'] });
      expect(User.findAll).toHaveBeenCalled();
    });

    it('should return clients in same city for provider', async () => {
      const userId = 'provider1';
      const mockUser = { city_id: 'city1', role: 'provider' };
      const mockClients = [
        { id: 'client1' },
        { id: 'client2' }
      ];

      User.findByPk.mockResolvedValue(mockUser);
      User.findAll.mockResolvedValue(mockClients);

      const result = await getProvidersInSameCity(userId);

      expect(result).toEqual(['client1', 'client2']);
      expect(User.findByPk).toHaveBeenCalledWith(userId, { attributes: ['city_id', 'role'] });
      expect(User.findAll).toHaveBeenCalled();
    });
  });

  describe('broadcastPresenceUpdate', () => {
    it('should broadcast to conversation participants', async () => {
      const userId = 'user1';
      const presenceData = { status: 'online' };
      const mockRelevantUsers = ['user2', 'user3'];

      // Mock the internal functions
      Conversation.findAll.mockResolvedValue([
        { userOneId: userId, userTwoId: 'user2' },
        { userOneId: 'user3', userTwoId: userId }
      ]);

      const result = await broadcastPresenceUpdate(mockIo, userId, presenceData);

      expect(result).toEqual(mockRelevantUsers);
      expect(mockIo.to).toHaveBeenCalledTimes(2);
      expect(mockIo.to).toHaveBeenCalledWith('user2');
      expect(mockIo.to).toHaveBeenCalledWith('user3');
      expect(mockIo.emit).toHaveBeenCalledTimes(2);
      expect(mockIo.emit).toHaveBeenCalledWith('presenceUpdate', {
        userId,
        ...presenceData,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('broadcastTypingIndicator', () => {
    it('should send typing indicator to recipient', () => {
      const senderId = 'user1';
      const recipientId = 'user2';
      const isTyping = true;

      broadcastTypingIndicator(mockIo, senderId, recipientId, isTyping);

      expect(mockIo.to).toHaveBeenCalledWith(recipientId);
      expect(mockIo.emit).toHaveBeenCalledWith('userTyping', {
        userId: senderId,
        isTyping,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('broadcastStatusChange', () => {
    it('should broadcast status change for users with visible status', async () => {
      const userId = 'user1';
      const status = 'online';
      const mockUser = {
        id: userId,
        last_activity: new Date(),
        custom_status_message: 'Available',
        show_online_status: true
      };

      User.findByPk.mockResolvedValue(mockUser);
      Conversation.findAll.mockResolvedValue([
        { userOneId: userId, userTwoId: 'user2' }
      ]);

      await broadcastStatusChange(mockIo, userId, status);

      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(mockIo.to).toHaveBeenCalledWith('user2');
      expect(mockIo.emit).toHaveBeenCalledWith('presenceUpdate', expect.objectContaining({
        userId,
        status,
        last_activity: mockUser.last_activity,
        custom_message: mockUser.custom_status_message,
        show_status: mockUser.show_online_status
      }));
    });

    it('should not broadcast for users with hidden status', async () => {
      const userId = 'user1';
      const status = 'online';
      const mockUser = {
        id: userId,
        show_online_status: false
      };

      User.findByPk.mockResolvedValue(mockUser);

      await broadcastStatusChange(mockIo, userId, status);

      expect(mockIo.to).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });
});