const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../index');
const { sequelize, User, Conversation, Message } = require('../src/models');
const { userService } = require('../src/services');

describe('Chat Presence Integration Tests', () => {
  let userA, userB, tokenA, tokenB, conversation;
  let clientSocketA, clientSocketB, httpServer, io;

  beforeAll(async () => {
    // Sync database
    await sequelize.sync({ force: true });

    // Create test users
    userA = await userService.createUser({ 
      name: 'User A', 
      email: 'usera@test.com', 
      password: 'password', 
      role: 'client',
      online_status: 'offline',
      show_online_status: true
    });
    
    userB = await userService.createUser({ 
      name: 'User B', 
      email: 'userb@test.com', 
      password: 'password', 
      role: 'provider',
      online_status: 'offline',
      show_online_status: true
    });

    // Get authentication tokens
    const resA = await request(app).post('/api/auth/login').send({ 
      email: 'usera@test.com', 
      password: 'password' 
    });
    tokenA = resA.body.tokens.access.token;
    
    const resB = await request(app).post('/api/auth/login').send({ 
      email: 'userb@test.com', 
      password: 'password' 
    });
    tokenB = resB.body.tokens.access.token;

    // Create a conversation
    conversation = await Conversation.create({ 
      userOneId: userA.id, 
      userTwoId: userB.id 
    });
  });

  beforeEach((done) => {
    // Set up Socket.IO server for each test
    httpServer = createServer(app);
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Initialize socket service
    require('../src/services/socket.service')(io);
    
    httpServer.listen(0, () => {
      const port = httpServer.address().port;
      
      clientSocketA = Client(`http://localhost:${port}`, { 
        auth: { token: tokenA },
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocketB = Client(`http://localhost:${port}`, { 
        auth: { token: tokenB },
        transports: ['websocket'],
        forceNew: true
      });
      
      let connectedClients = 0;
      
      const checkDone = () => {
        connectedClients++;
        if (connectedClients === 2) {
          done();
        }
      };
      
      clientSocketA.on('connect', checkDone);
      clientSocketB.on('connect', checkDone);
      
      clientSocketA.on('connect_error', done);
      clientSocketB.on('connect_error', done);
    });
  });

  afterEach(() => {
    if (clientSocketA) {
      clientSocketA.close();
    }
    if (clientSocketB) {
      clientSocketB.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Requirement 4.1: Online status in chat conversations', () => {
    it('should include presence information when getting conversations', async () => {
      // Create a message to ensure conversation appears
      await Message.create({
        conversationId: conversation.id,
        senderId: userA.id,
        content: 'Test message'
      });

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      
      const conversationData = res.body[0];
      expect(conversationData).toHaveProperty('otherUserPresence');
      expect(conversationData.otherUserPresence).toHaveProperty('userId');
      expect(conversationData.otherUserPresence).toHaveProperty('online_status');
      expect(conversationData.otherUserPresence).toHaveProperty('is_online');
      expect(conversationData.otherUserPresence).toHaveProperty('last_seen_text');
      expect(conversationData.otherUserPresence).toHaveProperty('show_status');
    });

    it('should include presence information when getting messages', async () => {
      // Create a message
      await Message.create({
        conversationId: conversation.id,
        senderId: userA.id,
        content: 'Test message with presence'
      });

      const res = await request(app)
        .get(`/api/chat/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      
      const messageData = res.body[0];
      expect(messageData).toHaveProperty('senderPresence');
      expect(messageData.senderPresence).toHaveProperty('userId');
      expect(messageData.senderPresence).toHaveProperty('online_status');
      expect(messageData.senderPresence).toHaveProperty('is_online');
      expect(messageData.senderPresence).toHaveProperty('last_seen_text');
    });

    it('should show current online status in conversation data', (done) => {
      // Add a small delay to ensure socket connection is fully established
      setTimeout(() => {
        clientSocketA.emit('joinConversation', {
          conversationId: conversation.id
        }, (response) => {
          expect(response.status).toBe('ok');
          expect(response.conversation).toBeDefined();
          expect(response.conversation.otherUserPresence).toBeDefined();
          expect(response.conversation.otherUserPresence.online_status).toBe('online');
          expect(response.conversation.otherUserPresence.is_online).toBe(true);
          done();
        });
      }, 100);
    });
  });

  describe('Requirement 4.2: Real-time status updates during chat', () => {
    it('should receive real-time presence updates in active conversations', (done) => {
      let presenceUpdateReceived = false;

      // User A listens for presence updates
      clientSocketA.on('presenceUpdate', (data) => {
        if (data.userId === userB.id && !presenceUpdateReceived) {
          presenceUpdateReceived = true;
          expect(data).toHaveProperty('status');
          expect(data).toHaveProperty('timestamp');
          done();
        }
      });

      // Wait for connections to be established, then change status
      setTimeout(() => {
        clientSocketB.emit('setStatus', {
          status: 'away',
          message: 'Away from chat'
        });
      }, 100);
    });

    it('should update presence when user goes offline during chat', (done) => {
      let offlineUpdateReceived = false;

      // User A listens for presence updates
      clientSocketA.on('presenceUpdate', (data) => {
        if (data.userId === userB.id && data.status === 'offline' && !offlineUpdateReceived) {
          offlineUpdateReceived = true;
          expect(data.status).toBe('offline');
          done();
        }
      });

      // Wait for connections, then disconnect user B
      setTimeout(() => {
        clientSocketB.disconnect();
      }, 100);
    });
  });

  describe('Requirement 4.3: Last seen time in chat', () => {
    it('should show last seen time when user is offline', async () => {
      // Set user B as offline with a specific last activity time
      const lastActivity = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      await User.update({
        online_status: 'offline',
        last_activity: lastActivity
      }, {
        where: { id: userB.id }
      });

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const conversationData = res.body[0];
      expect(conversationData.otherUserPresence.last_seen_text).toContain('hour');
      expect(conversationData.otherUserPresence.is_online).toBe(false);
    });

    it('should respect privacy settings for last seen time', async () => {
      // Set user B to hide online status
      await User.update({
        show_online_status: false,
        online_status: 'offline',
        last_activity: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      }, {
        where: { id: userB.id }
      });

      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const conversationData = res.body[0];
      expect(conversationData.otherUserPresence.last_seen_text).toBe('Last seen recently');
      expect(conversationData.otherUserPresence.show_status).toBe(false);
    });
  });

  describe('Requirement 4.4: Typing indicators', () => {
    it('should send and receive typing indicators', (done) => {
      let typingReceived = false;

      // User B listens for typing indicators
      clientSocketB.on('userTyping', (data) => {
        if (data.userId === userA.id && data.isTyping && !typingReceived) {
          typingReceived = true;
          expect(data.isTyping).toBe(true);
          expect(data.userId).toBe(userA.id);
          expect(data).toHaveProperty('timestamp');
          done();
        }
      });

      // Wait for connections, then send typing indicator
      setTimeout(() => {
        clientSocketA.emit('typing', {
          recipientId: userB.id,
          isTyping: true
        });
      }, 100);
    });

    it('should send stop typing indicator', (done) => {
      let stopTypingReceived = false;

      // User B listens for typing indicators
      clientSocketB.on('userTyping', (data) => {
        if (data.userId === userA.id && !data.isTyping && !stopTypingReceived) {
          stopTypingReceived = true;
          expect(data.isTyping).toBe(false);
          expect(data.userId).toBe(userA.id);
          done();
        }
      });

      // Wait for connections, then send stop typing indicator
      setTimeout(() => {
        clientSocketA.emit('typing', {
          recipientId: userB.id,
          isTyping: false
        });
      }, 100);
    });
  });

  describe('Requirement 4.5: Presence in chat messages', () => {
    it('should include sender presence information in real-time messages', (done) => {
      const messageContent = 'Message with presence info';

      // User B listens for new messages
      clientSocketB.on('newMessage', (data) => {
        expect(data.content).toBe(messageContent);
        expect(data).toHaveProperty('senderPresence');
        expect(data.senderPresence.userId).toBe(userA.id);
        expect(data.senderPresence.online_status).toBe('online');
        expect(data.senderPresence).toHaveProperty('timestamp');
        done();
      });

      // Wait for connections, then send message
      setTimeout(() => {
        clientSocketA.emit('sendMessage', {
          recipientId: userB.id,
          content: messageContent
        });
      }, 100);
    });

    it('should handle custom status messages in chat', (done) => {
      const customMessage = 'In a meeting';
      let statusSet = false;

      // User A listens for presence updates
      clientSocketA.on('presenceUpdate', (data) => {
        if (data.userId === userB.id && data.custom_message === customMessage && !statusSet) {
          statusSet = true;
          expect(data.status).toBe('dnd');
          expect(data.custom_message).toBe(customMessage);
          done();
        }
      });

      // Wait for connections, then set custom status
      setTimeout(() => {
        clientSocketB.emit('setStatus', {
          status: 'dnd',
          message: customMessage
        });
      }, 100);
    });
  });

  describe('Integration with existing chat functionality', () => {
    it('should maintain backward compatibility with existing chat features', (done) => {
      const messageContent = 'Backward compatibility test';

      // User B listens for new messages
      clientSocketB.on('newMessage', (data) => {
        // Verify existing message structure is maintained
        expect(data).toHaveProperty('content');
        expect(data).toHaveProperty('sender');
        expect(data.sender).toHaveProperty('id');
        expect(data.sender).toHaveProperty('name');
        
        // Verify presence information is added
        expect(data).toHaveProperty('senderPresence');
        
        done();
      });

      // Send message using existing API
      setTimeout(() => {
        clientSocketA.emit('sendMessage', {
          recipientId: userB.id,
          content: messageContent
        });
      }, 100);
    });

    it('should handle multiple conversation participants correctly', (done) => {
      // Test that presence updates are sent to the right conversation participants
      // Add a small delay to ensure socket connection is fully established
      setTimeout(() => {
        clientSocketA.emit('requestPresence', {
          userIds: [userB.id]
        }, (response) => {
          expect(response.status).toBe('ok');
          expect(response.presence).toHaveProperty(userB.id);
          expect(response.presence[userB.id]).toHaveProperty('online_status');
          done();
        });
      }, 100);
    });
  });
});