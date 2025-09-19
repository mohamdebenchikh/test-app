const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { sequelize, User, UserSession } = require('../models');
const { generateToken } = require('../utils/jwt');
const { hashPassword } = require('../utils/password');
const socketService = require('../services/socket.service');

describe('Socket Presence Integration', () => {
  let httpServer, io, clientSocket, serverSocket, testUser, userToken;

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

    const payload = {
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
      language: testUser.language
    };
    userToken = generateToken(payload);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await UserSession.destroy({ where: {}, force: true });
  });

  beforeEach((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    
    // Initialize socket service
    socketService(io);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: userToken
        }
      });
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterEach(() => {
    if (io) {
      io.close();
    }
    if (clientSocket) {
      clientSocket.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  describe('Connection and Presence', () => {
    test('should set user online when connecting', (done) => {
      setTimeout(async () => {
        try {
          // Check user status in database
          await testUser.reload();
          expect(testUser.online_status).toBe('online');
          
          // Check session created
          const session = await UserSession.findOne({
            where: { user_id: testUser.id, is_active: true }
          });
          expect(session).toBeTruthy();
          expect(session.socket_id).toBe(clientSocket.id);
          
          done();
        } catch (error) {
          done(error);
        }
      }, 100);
    });

    test('should broadcast user online status', (done) => {
      // Create another client to receive the broadcast
      const anotherClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: userToken
        }
      });

      anotherClient.on('userOnline', (data) => {
        expect(data.userId).toBe(testUser.id);
        expect(data.status).toBe('online');
        expect(data.timestamp).toBeTruthy();
        
        anotherClient.close();
        done();
      });

      // Trigger connection after listener is set up
      setTimeout(() => {
        clientSocket.connect();
      }, 50);
    });

    test('should set user offline when disconnecting', (done) => {
      setTimeout(async () => {
        clientSocket.disconnect();
        
        // Wait for disconnect processing
        setTimeout(async () => {
          try {
            await testUser.reload();
            expect(testUser.online_status).toBe('offline');
            
            // Check session deactivated
            const session = await UserSession.findOne({
              where: { user_id: testUser.id, socket_id: clientSocket.id }
            });
            expect(session.is_active).toBe(false);
            
            done();
          } catch (error) {
            done(error);
          }
        }, 100);
      }, 100);
    });
  });

  describe('Activity Tracking', () => {
    test('should update last activity on activity event', (done) => {
      setTimeout(async () => {
        const oldActivity = testUser.last_activity;
        
        // Wait a bit then send activity
        setTimeout(() => {
          clientSocket.emit('activity');
          
          // Check activity updated
          setTimeout(async () => {
            try {
              await testUser.reload();
              expect(testUser.last_activity.getTime()).toBeGreaterThan(oldActivity.getTime());
              done();
            } catch (error) {
              done(error);
            }
          }, 100);
        }, 10);
      }, 100);
    });
  });

  describe('Custom Status', () => {
    test('should update custom status', (done) => {
      setTimeout(() => {
        clientSocket.emit('setStatus', {
          status: 'away',
          message: 'In a meeting'
        }, async (response) => {
          try {
            expect(response.status).toBe('ok');
            
            await testUser.reload();
            expect(testUser.online_status).toBe('away');
            expect(testUser.custom_status_message).toBe('In a meeting');
            
            done();
          } catch (error) {
            done(error);
          }
        });
      }, 100);
    });

    test('should broadcast status updates', (done) => {
      // Create another client to receive the broadcast
      const anotherClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: userToken
        }
      });

      anotherClient.on('statusUpdate', (data) => {
        expect(data.userId).toBe(testUser.id);
        expect(data.status).toBe('dnd');
        expect(data.message).toBe('Do not disturb');
        
        anotherClient.close();
        done();
      });

      setTimeout(() => {
        clientSocket.emit('setStatus', {
          status: 'dnd',
          message: 'Do not disturb'
        });
      }, 100);
    });

    test('should handle invalid status', (done) => {
      setTimeout(() => {
        clientSocket.emit('setStatus', {
          status: 'invalid'
        }, (response) => {
          expect(response.status).toBe('error');
          expect(response.message).toBe('Failed to update status.');
          done();
        });
      }, 100);
    });
  });

  describe('Typing Indicators', () => {
    test('should send typing indicators', (done) => {
      // Create another user and client
      const recipientClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: {
          token: userToken
        }
      });

      recipientClient.on('userTyping', (data) => {
        expect(data.userId).toBe(testUser.id);
        expect(data.isTyping).toBe(true);
        
        recipientClient.close();
        done();
      });

      setTimeout(() => {
        clientSocket.emit('typing', {
          recipientId: testUser.id, // Using same user for simplicity
          isTyping: true
        });
      }, 100);
    });
  });

  describe('Presence Requests', () => {
    test('should get user presence', (done) => {
      setTimeout(() => {
        clientSocket.emit('getPresence', {
          userId: testUser.id
        }, (response) => {
          expect(response.status).toBe('ok');
          expect(response.presence).toBeTruthy();
          expect(response.presence.userId).toBe(testUser.id);
          expect(response.presence.online_status).toBe('online');
          done();
        });
      }, 100);
    });

    test('should handle invalid presence request', (done) => {
      setTimeout(() => {
        clientSocket.emit('getPresence', {
          userId: 'invalid-id'
        }, (response) => {
          expect(response.status).toBe('error');
          expect(response.message).toBe('Failed to get user presence.');
          done();
        });
      }, 100);
    });
  });
});