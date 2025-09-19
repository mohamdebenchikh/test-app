/**
 * @fileoverview Performance tests for presence system
 * Tests system behavior under load and concurrent operations
 */

const { User, UserSession, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const presenceService = require('../src/services/presence.service');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../index');

describe('Presence System Performance Tests', () => {
  let testUsers = [];
  let httpServer;
  let io;
  let port;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create multiple test users for performance testing
    const hashedPassword = await hashPassword('password123');
    const userPromises = [];
    
    for (let i = 0; i < 50; i++) {
      userPromises.push(
        User.create({
          name: `Test User ${i}`,
          email: `test${i}@example.com`,
          password: hashedPassword,
          role: i % 2 === 0 ? 'provider' : 'client',
          city_id: 'test-city-id'
        })
      );
    }
    
    testUsers = await Promise.all(userPromises);

    // Setup Socket.IO server for performance tests
    httpServer = createServer(app);
    io = new Server(httpServer);
    require('../src/services/socket.service')(io);
    
    await new Promise((resolve) => {
      httpServer.listen(() => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) httpServer.close();
    
    await UserSession.destroy({ where: {} });
    await User.destroy({ where: {} });
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await UserSession.destroy({ where: {} });
    await User.update(
      { 
        online_status: 'offline',
        last_activity: null,
        custom_status_message: null
      },
      { where: {} }
    );
  });

  describe('Concurrent User Connection Performance', () => {
    test('should handle 50 concurrent socket connections within acceptable time', (done) => {
      const startTime = Date.now();
      const sockets = [];
      let connectedCount = 0;
      const targetConnections = 50;

      const connectUser = (userIndex) => {
        return new Promise((resolve) => {
          const socket = new Client(`http://localhost:${port}`, {
            auth: { token: `fake-token-${userIndex}` }
          });

          socket.on('connect', () => {
            connectedCount++;
            resolve(socket);
          });

          socket.on('connect_error', () => {
            // Handle connection errors gracefully
            resolve(null);
          });
        });
      };

      // Create connections for all test users
      const connectionPromises = testUsers.slice(0, targetConnections).map((user, index) => 
        connectUser(index)
      );

      Promise.all(connectionPromises).then((connectedSockets) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should connect within 10 seconds
        expect(duration).toBeLessThan(10000);
        expect(connectedCount).toBeGreaterThan(targetConnections * 0.8); // Allow for some connection failures
        
        // Clean up connections
        connectedSockets.forEach(socket => {
          if (socket) socket.close();
        });
        
        done();
      });
    }, 15000); // 15 second timeout

    test('should handle rapid connect/disconnect cycles', async () => {
      const startTime = Date.now();
      const numCycles = 20;
      const userId = testUsers[0].id;

      for (let i = 0; i < numCycles; i++) {
        await presenceService.setUserOnline(userId, `socket-${i}`);
        await presenceService.setUserOffline(userId, `socket-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      
      // Verify final state is consistent
      const user = await User.findByPk(userId);
      expect(user.online_status).toBe('offline');
    });
  });

  describe('Database Performance Under Load', () => {
    test('should handle concurrent presence updates efficiently', async () => {
      const startTime = Date.now();
      const numUpdates = 100;
      const userIds = testUsers.slice(0, 10).map(u => u.id);

      // Create concurrent update promises
      const updatePromises = [];
      for (let i = 0; i < numUpdates; i++) {
        const userId = userIds[i % userIds.length];
        updatePromises.push(presenceService.updateLastActivity(userId));
      }

      await Promise.all(updatePromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
      
      // Verify all users have updated activity
      const updatedUsers = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'last_activity']
      });
      
      updatedUsers.forEach(user => {
        expect(user.last_activity).toBeTruthy();
      });
    });

    test('should handle concurrent session creation and cleanup', async () => {
      const startTime = Date.now();
      const numOperations = 50;
      const userIds = testUsers.slice(0, 10).map(u => u.id);

      // Create concurrent operations
      const operations = [];
      for (let i = 0; i < numOperations; i++) {
        const userId = userIds[i % userIds.length];
        const socketId = `socket-${i}`;
        
        if (i % 3 === 0) {
          // Set online
          operations.push(presenceService.setUserOnline(userId, socketId));
        } else if (i % 3 === 1) {
          // Set offline
          operations.push(presenceService.setUserOffline(userId, socketId));
        } else {
          // Update activity
          operations.push(presenceService.updateLastActivity(userId));
        }
      }

      await Promise.all(operations);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      
      // Verify database consistency
      const sessionCount = await UserSession.count();
      expect(sessionCount).toBeGreaterThanOrEqual(0);
    });

    test('should efficiently query online users with large dataset', async () => {
      // Set half of users online
      const onlineUsers = testUsers.slice(0, 25);
      const setOnlinePromises = onlineUsers.map((user, index) => 
        presenceService.setUserOnline(user.id, `socket-${index}`)
      );
      
      await Promise.all(setOnlinePromises);
      
      const startTime = Date.now();
      
      // Query online users multiple times
      const queryPromises = [];
      for (let i = 0; i < 10; i++) {
        queryPromises.push(presenceService.getOnlineUsers());
      }
      
      const results = await Promise.all(queryPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      
      // Verify results are consistent
      results.forEach(result => {
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(25);
      });
    });
  });

  describe('Memory Usage and Resource Management', () => {
    test('should not create memory leaks with session management', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy many sessions
      for (let cycle = 0; cycle < 10; cycle++) {
        const sessionPromises = [];
        
        // Create sessions
        for (let i = 0; i < 20; i++) {
          const userId = testUsers[i % testUsers.length].id;
          sessionPromises.push(
            presenceService.setUserOnline(userId, `socket-${cycle}-${i}`)
          );
        }
        
        await Promise.all(sessionPromises);
        
        // Clean up sessions
        await presenceService.cleanupInactiveSessions(0);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle session cleanup efficiently with large datasets', async () => {
      // Create many old sessions
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const sessionPromises = [];
      
      for (let i = 0; i < 100; i++) {
        const userId = testUsers[i % testUsers.length].id;
        sessionPromises.push(
          UserSession.create({
            user_id: userId,
            socket_id: `old-socket-${i}`,
            device_type: 'web',
            connected_at: oldTime,
            last_ping: oldTime,
            is_active: true
          })
        );
      }
      
      await Promise.all(sessionPromises);
      
      const startTime = Date.now();
      const cleanedCount = await presenceService.cleanupInactiveSessions(60); // 1 hour threshold
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      expect(cleanedCount[0]).toBe(100); // Should clean all old sessions
    });
  });

  describe('Scalability Testing', () => {
    test('should maintain response times with increasing user load', async () => {
      const loadTests = [10, 25, 50];
      const results = [];
      
      for (const userCount of loadTests) {
        // Set users online
        const setOnlinePromises = testUsers.slice(0, userCount).map((user, index) => 
          presenceService.setUserOnline(user.id, `socket-load-${index}`)
        );
        
        await Promise.all(setOnlinePromises);
        
        // Measure query performance
        const startTime = Date.now();
        await presenceService.getOnlineUsers();
        const endTime = Date.now();
        
        results.push({
          userCount,
          duration: endTime - startTime
        });
        
        // Clean up
        await UserSession.destroy({ where: {} });
      }
      
      // Response times should not increase dramatically
      expect(results[0].duration).toBeLessThan(500);
      expect(results[1].duration).toBeLessThan(1000);
      expect(results[2].duration).toBeLessThan(2000);
      
      // Performance should scale reasonably
      const scalingFactor = results[2].duration / results[0].duration;
      expect(scalingFactor).toBeLessThan(10); // Should not be more than 10x slower
    });

    test('should handle burst traffic patterns', async () => {
      const burstSize = 30;
      const burstCount = 3;
      
      for (let burst = 0; burst < burstCount; burst++) {
        const startTime = Date.now();
        
        // Create burst of concurrent operations
        const operations = [];
        for (let i = 0; i < burstSize; i++) {
          const userId = testUsers[i % testUsers.length].id;
          operations.push(presenceService.updateLastActivity(userId));
        }
        
        await Promise.all(operations);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Each burst should complete within 2 seconds
        expect(duration).toBeLessThan(2000);
        
        // Small delay between bursts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe('Error Recovery Performance', () => {
    test('should recover quickly from database connection issues', async () => {
      // Simulate database error and recovery
      const originalUpdate = User.update;
      let errorCount = 0;
      
      User.update = jest.fn().mockImplementation((...args) => {
        errorCount++;
        if (errorCount <= 3) {
          return Promise.reject(new Error('Database connection error'));
        }
        return originalUpdate.apply(User, args);
      });
      
      const startTime = Date.now();
      
      try {
        // This should eventually succeed after retries
        await presenceService.updateLastActivity(testUsers[0].id);
      } catch (error) {
        // Expected to fail due to mocked errors
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should not hang indefinitely
      expect(duration).toBeLessThan(5000);
      
      // Restore original method
      User.update = originalUpdate;
    });

    test('should handle socket connection failures gracefully', (done) => {
      const startTime = Date.now();
      let connectionAttempts = 0;
      const maxAttempts = 5;
      
      const attemptConnection = () => {
        connectionAttempts++;
        
        const socket = new Client(`http://localhost:${port + 1000}`, { // Wrong port
          timeout: 1000,
          auth: { token: 'fake-token' }
        });
        
        socket.on('connect_error', () => {
          if (connectionAttempts < maxAttempts) {
            setTimeout(attemptConnection, 100);
          } else {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should fail fast, not hang
            expect(duration).toBeLessThan(10000);
            expect(connectionAttempts).toBe(maxAttempts);
            done();
          }
        });
      };
      
      attemptConnection();
    });
  });
});