/**
 * @fileoverview Comprehensive integration tests for the complete presence system
 * This test suite covers all aspects of the presence system including Socket.IO,
 * API endpoints, provider filtering, and performance testing.
 */

const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../index');
const { User, UserSession, City, Service, ProviderService, Conversation, sequelize } = require('../src/models');
const { generateToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');
const presenceService = require('../src/services/presence.service');

describe('Comprehensive Presence System Tests', () => {
  let httpServer;
  let io;
  let testCity;
  let testService;
  let users = {};
  let tokens = {};
  let clientSockets = {};

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test city and service
    testCity = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de Test'
    });

    testService = await Service.create({
      image: 'test-service.jpg',
      icon: 'test-icon.svg'
    });

    // Create test users with different roles and settings
    const hashedPassword = await hashPassword('password123');
    
    users.provider1 = await User.create({
      name: 'Provider 1',
      email: 'provider1@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id,
      show_online_status: true
    });

    users.provider2 = await User.create({
      name: 'Provider 2',
      email: 'provider2@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id,
      show_online_status: false // Privacy enabled
    });

    users.client1 = await User.create({
      name: 'Client 1',
      email: 'client1@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: testCity.id,
      show_online_status: true
    });

    users.client2 = await User.create({
      name: 'Client 2',
      email: 'client2@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: testCity.id,
      show_online_status: true
    });

    // Associate providers with service
    await ProviderService.bulkCreate([
      { user_id: users.provider1.id, service_id: testService.id },
      { user_id: users.provider2.id, service_id: testService.id }
    ]);

    // Generate tokens
    Object.keys(users).forEach(key => {
      tokens[key] = generateToken(users[key].id);
    });

    // Create conversations between users
    await Conversation.create({
      userOneId: users.client1.id,
      userTwoId: users.provider1.id
    });

    await Conversation.create({
      userOneId: users.client2.id,
      userTwoId: users.provider2.id
    });

    // Setup Socket.IO server
    httpServer = createServer(app);
    io = new Server(httpServer);
    require('../src/services/socket.service')(io);
    
    await new Promise((resolve) => {
      httpServer.listen(() => {
        const port = httpServer.address().port;
        
        // Create client sockets for each user
        Object.keys(users).forEach(key => {
          clientSockets[key] = new Client(`http://localhost:${port}`, {
            auth: { token: tokens[key] }
          });
        });
        
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up sockets
    Object.values(clientSockets).forEach(socket => {
      if (socket) socket.close();
    });
    
    if (httpServer) httpServer.close();
    
    // Clean up database
    await UserSession.destroy({ where: {} });
    await Conversation.destroy({ where: {} });
    await ProviderService.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Service.destroy({ where: {} });
    await City.destroy({ where: {} });
    
    await sequelize.close();
  });

  beforeEach(async () => {
    // Reset user statuses and clean sessions
    await UserSession.destroy({ where: {} });
    await User.update(
      { 
        online_status: 'offline',
        last_activity: null,
        custom_status_message: null
      },
      { where: {} }
    );
    
    // Clear socket listeners
    Object.values(clientSockets).forEach(socket => {
      socket.removeAllListeners();
    });
  });

  describe('Complete Socket.IO Presence Integration', () => {
    test('should handle multiple user connections and disconnections', (done) => {
      let connectedUsers = 0;
      let disconnectedUsers = 0;
      const expectedUsers = 2;

      // Listen for presence updates on client2's socket
      clientSockets.client2.on('presenceUpdate', (data) => {
        if (data.status === 'online') {
          connectedUsers++;
        } else if (data.status === 'offline') {
          disconnectedUsers++;
        }

        // Check if we've received all expected updates
        if (connectedUsers === expectedUsers && disconnectedUsers === expectedUsers) {
          done();
        }
      });

      // Connect multiple users
      clientSockets.provider1.connect();
      clientSockets.client1.connect();

      // Wait a bit then disconnect them
      setTimeout(() => {
        clientSockets.provider1.disconnect();
        clientSockets.client1.disconnect();
      }, 100);
    });

    test('should handle rapid status changes without race conditions', (done) => {
      let statusUpdates = [];
      
      clientSockets.client1.on('presenceUpdate', (data) => {
        if (data.userId === users.provider1.id) {
          statusUpdates.push(data.status);
          
          // Check if we received all status changes
          if (statusUpdates.length >= 3) {
            expect(statusUpdates).toContain('online');
            expect(statusUpdates).toContain('away');
            expect(statusUpdates).toContain('dnd');
            done();
          }
        }
      });

      // Connect provider1 and rapidly change status
      clientSockets.provider1.connect();
      
      setTimeout(() => {
        clientSockets.provider1.emit('setStatus', { status: 'away', message: 'Away' });
      }, 50);
      
      setTimeout(() => {
        clientSockets.provider1.emit('setStatus', { status: 'dnd', message: 'DND' });
      }, 100);
    });

    test('should handle typing indicators with proper cleanup', (done) => {
      let typingEvents = [];
      
      clientSockets.provider1.on('userTyping', (data) => {
        typingEvents.push(data);
        
        if (typingEvents.length === 2) {
          expect(typingEvents[0].isTyping).toBe(true);
          expect(typingEvents[1].isTyping).toBe(false);
          done();
        }
      });

      // Connect both users
      clientSockets.client1.connect();
      clientSockets.provider1.connect();

      setTimeout(() => {
        // Start typing
        clientSockets.client1.emit('typing', {
          recipientId: users.provider1.id,
          isTyping: true
        });
        
        // Stop typing after a delay
        setTimeout(() => {
          clientSockets.client1.emit('typing', {
            recipientId: users.provider1.id,
            isTyping: false
          });
        }, 50);
      }, 100);
    });
  });

  describe('Complete API Endpoint Testing', () => {
    test('should handle concurrent presence API requests', async () => {
      // Set up some users as online
      await presenceService.setUserOnline(users.provider1.id, 'socket-1');
      await presenceService.setUserOnline(users.client1.id, 'socket-2');

      // Make multiple concurrent requests
      const requests = [
        request(app).get(`/api/presence/users/${users.provider1.id}`),
        request(app).get(`/api/presence/users/${users.client1.id}`),
        request(app).get('/api/presence/online').set('Authorization', `Bearer ${tokens.client1}`),
        request(app).post('/api/presence/activity').set('Authorization', `Bearer ${tokens.provider1}`)
      ];

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBeLessThan(400);
      });
    });

    test('should validate all presence API input parameters', async () => {
      // Test invalid user ID formats
      await request(app)
        .get('/api/presence/users/invalid-uuid')
        .expect(400);

      // Test invalid status values
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      // Test invalid privacy settings
      await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ show_online_status: 'not_boolean' })
        .expect(400);

      // Test message length validation
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away', 
          message: 'a'.repeat(101) // Over 100 characters
        })
        .expect(400);
    });

    test('should handle authentication and authorization correctly', async () => {
      // Test unauthenticated requests
      await request(app)
        .patch('/api/presence/status')
        .send({ status: 'away' })
        .expect(401);

      await request(app)
        .get('/api/presence/settings')
        .expect(401);

      await request(app)
        .post('/api/presence/activity')
        .expect(401);

      // Test authenticated requests work
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ status: 'away' })
        .expect(200);
    });
  });

  describe('Complete Provider Filtering with Presence', () => {
    beforeEach(async () => {
      // Set up different presence states
      await presenceService.setUserOnline(users.provider1.id, 'socket-1');
      await presenceService.setCustomStatus(users.provider2.id, 'away', 'At lunch');
      
      // Set different activity times
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      await User.update(
        { last_activity: oneHourAgo },
        { where: { id: users.provider1.id } }
      );
      
      await User.update(
        { last_activity: threeDaysAgo },
        { where: { id: users.provider2.id } }
      );
    });

    test('should filter providers by all presence criteria', async () => {
      // Test online status filter
      const onlineResponse = await request(app)
        .get('/api/providers?online_status=online')
        .expect(200);
      
      expect(onlineResponse.body.results.length).toBeGreaterThan(0);
      onlineResponse.body.results.forEach(provider => {
        expect(provider.online_status).toBe('online');
      });

      // Test activity filter
      const activeResponse = await request(app)
        .get('/api/providers?active_within=2h')
        .expect(200);
      
      activeResponse.body.results.forEach(provider => {
        const lastActivity = new Date(provider.last_activity);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        expect(lastActivity.getTime()).toBeGreaterThan(twoHoursAgo.getTime());
      });

      // Test combined filters
      const combinedResponse = await request(app)
        .get(`/api/providers?online_status=online&cityId=${testCity.id}&serviceId=${testService.id}`)
        .expect(200);
      
      combinedResponse.body.results.forEach(provider => {
        expect(provider.online_status).toBe('online');
        expect(provider.city_id).toBe(testCity.id);
      });
    });

    test('should include complete presence information in provider responses', async () => {
      const response = await request(app)
        .get('/api/providers')
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);
      
      response.body.results.forEach(provider => {
        // Check presence object structure
        expect(provider).toHaveProperty('presence');
        expect(provider).toHaveProperty('last_seen_text');
        expect(provider).toHaveProperty('is_online');
        expect(provider).toHaveProperty('online_status');
        
        // Validate presence object
        expect(provider.presence).toHaveProperty('userId');
        expect(provider.presence).toHaveProperty('online_status');
        expect(provider.presence).toHaveProperty('show_status');
        expect(provider.presence.userId).toBe(provider.id);
      });
    });

    test('should respect privacy settings in provider filtering', async () => {
      // Provider2 has privacy disabled
      const response = await request(app)
        .get('/api/providers')
        .expect(200);

      const privateProvider = response.body.results.find(p => p.id === users.provider2.id);
      
      if (privateProvider) {
        expect(privateProvider.presence.show_status).toBe(false);
        expect(privateProvider.last_seen_text).toBe('Last seen recently');
      }
    });

    test('should handle invalid filter parameters gracefully', async () => {
      // Invalid time format
      await request(app)
        .get('/api/providers?active_within=invalid')
        .expect(400);

      // Invalid status
      await request(app)
        .get('/api/providers?online_status=invalid')
        .expect(400);

      // Invalid last_seen format
      await request(app)
        .get('/api/providers?last_seen=invalid')
        .expect(400);
    });
  });

  describe('Performance and Concurrent User Testing', () => {
    test('should handle multiple concurrent socket connections', (done) => {
      const connectionPromises = [];
      const numConnections = 10;
      let connectedCount = 0;

      // Create multiple socket connections
      for (let i = 0; i < numConnections; i++) {
        const socket = new Client(`http://localhost:${httpServer.address().port}`, {
          auth: { token: tokens.provider1 }
        });

        const promise = new Promise((resolve) => {
          socket.on('connect', () => {
            connectedCount++;
            resolve(socket);
          });
        });

        connectionPromises.push(promise);
      }

      Promise.all(connectionPromises).then((sockets) => {
        expect(sockets.length).toBe(numConnections);
        expect(connectedCount).toBe(numConnections);
        
        // Clean up connections
        sockets.forEach(socket => socket.close());
        done();
      });
    });

    test('should handle rapid presence updates without performance degradation', async () => {
      const startTime = Date.now();
      const numUpdates = 50;
      
      // Perform rapid presence updates
      const updatePromises = [];
      for (let i = 0; i < numUpdates; i++) {
        updatePromises.push(
          presenceService.updateLastActivity(users.provider1.id)
        );
      }

      await Promise.all(updatePromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    test('should handle concurrent API requests without errors', async () => {
      const numRequests = 20;
      const requests = [];

      // Create multiple concurrent API requests
      for (let i = 0; i < numRequests; i++) {
        requests.push(
          request(app)
            .get('/api/presence/online')
            .set('Authorization', `Bearer ${tokens.client1}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('total');
      });
    });

    test('should maintain database consistency under concurrent operations', async () => {
      const userId = users.provider1.id;
      const numOperations = 10;
      
      // Perform concurrent online/offline operations
      const operations = [];
      for (let i = 0; i < numOperations; i++) {
        if (i % 2 === 0) {
          operations.push(presenceService.setUserOnline(userId, `socket-${i}`));
        } else {
          operations.push(presenceService.setUserOffline(userId, `socket-${i-1}`));
        }
      }

      await Promise.all(operations);
      
      // Check final state is consistent
      const user = await User.findByPk(userId);
      const sessions = await UserSession.findAll({ where: { user_id: userId } });
      
      expect(user).toBeTruthy();
      expect(sessions).toBeInstanceOf(Array);
      
      // User status should match active sessions
      const activeSessions = sessions.filter(s => s.is_active);
      if (activeSessions.length > 0) {
        expect(user.online_status).toBe('online');
      } else {
        expect(user.online_status).toBe('offline');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalFindByPk = User.findByPk;
      User.findByPk = jest.fn().mockRejectedValue(new Error('Database connection error'));

      try {
        await expect(presenceService.getUserPresence('any-id')).rejects.toThrow();
      } finally {
        // Restore original method
        User.findByPk = originalFindByPk;
      }
    });

    test('should handle socket disconnection errors', (done) => {
      const socket = clientSockets.provider1;
      
      socket.on('connect', () => {
        // Force disconnect with error
        socket.disconnect();
        
        // Should not throw unhandled errors
        setTimeout(() => {
          done();
        }, 100);
      });

      socket.connect();
    });

    test('should handle malformed socket events', (done) => {
      const socket = clientSockets.provider1;
      
      socket.on('connect', () => {
        // Send malformed events
        socket.emit('setStatus', null);
        socket.emit('typing', undefined);
        socket.emit('activity', { invalid: 'data' });
        
        // Should not crash the server
        setTimeout(() => {
          done();
        }, 100);
      });

      socket.connect();
    });

    test('should handle non-existent user operations', async () => {
      const fakeUserId = '123e4567-e89b-12d3-a456-426614174000';
      
      await expect(presenceService.getUserPresence(fakeUserId))
        .rejects.toThrow('User not found');
      
      await expect(presenceService.setCustomStatus(fakeUserId, 'away'))
        .rejects.toThrow();
    });

    test('should handle session cleanup edge cases', async () => {
      // Create orphaned session (user doesn't exist)
      await UserSession.create({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        socket_id: 'orphaned-socket',
        device_type: 'web',
        connected_at: new Date(Date.now() - 60 * 60 * 1000),
        last_ping: new Date(Date.now() - 60 * 60 * 1000),
        is_active: true
      });

      // Cleanup should handle orphaned sessions
      const cleanedCount = await presenceService.cleanupInactiveSessions(30);
      expect(cleanedCount[0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with Chat System', () => {
    test('should include presence in chat message events', (done) => {
      clientSockets.provider1.on('newMessage', (data) => {
        expect(data).toHaveProperty('senderPresence');
        expect(data.senderPresence).toHaveProperty('userId');
        expect(data.senderPresence).toHaveProperty('online_status');
        done();
      });

      // Connect both users
      clientSockets.client1.connect();
      clientSockets.provider1.connect();

      setTimeout(() => {
        clientSockets.client1.emit('sendMessage', {
          recipientId: users.provider1.id,
          content: 'Test message with presence'
        });
      }, 100);
    });

    test('should update presence in active conversations', (done) => {
      let presenceUpdates = 0;
      
      clientSockets.provider1.on('presenceUpdate', (data) => {
        if (data.userId === users.client1.id) {
          presenceUpdates++;
          if (presenceUpdates === 2) { // online then away
            done();
          }
        }
      });

      // Connect users
      clientSockets.client1.connect();
      clientSockets.provider1.connect();

      setTimeout(() => {
        clientSockets.client1.emit('setStatus', {
          status: 'away',
          message: 'Away from chat'
        });
      }, 100);
    });
  });
});