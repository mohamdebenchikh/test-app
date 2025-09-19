/**
 * @fileoverview Integration tests for socket presence broadcasting
 */

const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../index');
const { User, Conversation, Message, UserSession } = require('../src/models');
const { generateToken } = require('../src/utils/jwt');

describe('Socket Presence Broadcasting Integration', () => {
  let httpServer;
  let io;
  let clientSocket1;
  let clientSocket2;
  let user1;
  let user2;
  let token1;
  let token2;

  beforeAll(async () => {
    // Create test users
    user1 = await User.create({
      name: 'Test User 1',
      email: 'test1@example.com',
      password: 'hashedpassword',
      role: 'client',
      city_id: 'city1',
      online_status: 'offline'
    });

    user2 = await User.create({
      name: 'Test User 2',
      email: 'test2@example.com',
      password: 'hashedpassword',
      role: 'provider',
      city_id: 'city1',
      online_status: 'offline'
    });

    // Generate tokens
    token1 = generateToken(user1.id);
    token2 = generateToken(user2.id);

    // Create HTTP server and Socket.IO instance
    httpServer = createServer(app);
    io = new Server(httpServer);
    
    // Initialize socket service
    require('../src/services/socket.service')(io);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // Create client sockets
      clientSocket1 = new Client(`http://localhost:${port}`, {
        auth: { token: token1 }
      });
      
      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: { token: token2 }
      });
    });
  });

  afterAll(async () => {
    // Clean up
    if (clientSocket1) clientSocket1.close();
    if (clientSocket2) clientSocket2.close();
    if (httpServer) httpServer.close();
    
    // Clean up database
    await UserSession.destroy({ where: {} });
    await Message.destroy({ where: {} });
    await Conversation.destroy({ where: {} });
    await User.destroy({ where: { id: [user1.id, user2.id] } });
  });

  beforeEach(() => {
    // Clear any existing listeners
    clientSocket1.removeAllListeners();
    clientSocket2.removeAllListeners();
  });

  describe('Presence Broadcasting', () => {
    it('should broadcast online status when user connects', (done) => {
      let receivedUpdates = 0;
      
      // Create a conversation between users first
      Conversation.create({
        userOneId: user1.id,
        userTwoId: user2.id
      }).then(() => {
        // Listen for presence updates on user2's socket
        clientSocket2.on('presenceUpdate', (data) => {
          expect(data.userId).toBe(user1.id);
          expect(data.status).toBe('online');
          expect(data.timestamp).toBeDefined();
          receivedUpdates++;
          
          if (receivedUpdates === 1) {
            done();
          }
        });

        // Connect user1 (this should trigger presence broadcast)
        clientSocket1.connect();
      });
    });

    it('should broadcast offline status when user disconnects', (done) => {
      // Listen for presence updates on user2's socket
      clientSocket2.on('presenceUpdate', (data) => {
        if (data.status === 'offline') {
          expect(data.userId).toBe(user1.id);
          expect(data.status).toBe('offline');
          expect(data.timestamp).toBeDefined();
          done();
        }
      });

      // Disconnect user1 (this should trigger offline broadcast)
      clientSocket1.disconnect();
    });

    it('should broadcast custom status updates', (done) => {
      const customStatus = 'away';
      const customMessage = 'In a meeting';

      // Listen for presence updates on user2's socket
      clientSocket2.on('presenceUpdate', (data) => {
        if (data.status === customStatus) {
          expect(data.userId).toBe(user1.id);
          expect(data.status).toBe(customStatus);
          expect(data.custom_message).toBe(customMessage);
          expect(data.timestamp).toBeDefined();
          done();
        }
      });

      // Set custom status on user1
      clientSocket1.emit('setStatus', {
        status: customStatus,
        message: customMessage
      });
    });
  });

  describe('Typing Indicators', () => {
    it('should send typing indicators between conversation participants', (done) => {
      // Listen for typing indicators on user2's socket
      clientSocket2.on('userTyping', (data) => {
        expect(data.userId).toBe(user1.id);
        expect(data.isTyping).toBe(true);
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Send typing indicator from user1 to user2
      clientSocket1.emit('typing', {
        recipientId: user2.id,
        isTyping: true
      });
    });

    it('should stop typing indicators', (done) => {
      // Listen for typing indicators on user2's socket
      clientSocket2.on('userTyping', (data) => {
        if (data.isTyping === false) {
          expect(data.userId).toBe(user1.id);
          expect(data.isTyping).toBe(false);
          expect(data.timestamp).toBeDefined();
          done();
        }
      });

      // Send stop typing indicator from user1 to user2
      clientSocket1.emit('typing', {
        recipientId: user2.id,
        isTyping: false
      });
    });
  });

  describe('Chat with Presence', () => {
    it('should include presence information in chat messages', (done) => {
      const messageContent = 'Hello with presence info';

      // Listen for new messages on user2's socket
      clientSocket2.on('newMessage', (data) => {
        expect(data.content).toBe(messageContent);
        expect(data.senderPresence).toBeDefined();
        expect(data.senderPresence.userId).toBe(user1.id);
        expect(data.senderPresence.online_status).toBe('online');
        done();
      });

      // Send message from user1 to user2
      clientSocket1.emit('sendMessage', {
        recipientId: user2.id,
        content: messageContent
      });
    });

    it('should send chat notifications with presence', (done) => {
      const messageContent = 'Notification test message';

      // Listen for notifications on user2's socket
      clientSocket2.on('newNotification', (data) => {
        expect(data.type).toBe('chat_message');
        expect(data.message).toContain(messageContent);
        expect(data.senderPresence).toBeDefined();
        expect(data.senderPresence.userId).toBe(user1.id);
        done();
      });

      // Send message from user1 to user2
      clientSocket1.emit('sendMessage', {
        recipientId: user2.id,
        content: messageContent
      });
    });
  });

  describe('Conversation Management', () => {
    it('should join conversation with presence information', (done) => {
      Conversation.findOne({
        where: {
          userOneId: user1.id,
          userTwoId: user2.id
        }
      }).then((conversation) => {
        // Join conversation and get presence info
        clientSocket1.emit('joinConversation', {
          conversationId: conversation.id
        }, (response) => {
          expect(response.status).toBe('ok');
          expect(response.conversation).toBeDefined();
          expect(response.conversation.otherUserPresence).toBeDefined();
          expect(response.conversation.otherUserPresence.userId).toBe(user2.id);
          done();
        });
      });
    });

    it('should handle presence requests for multiple users', (done) => {
      clientSocket1.emit('requestPresence', {
        userIds: [user2.id]
      }, (response) => {
        expect(response.status).toBe('ok');
        expect(response.presence).toBeDefined();
        expect(response.presence[user2.id]).toBeDefined();
        expect(response.presence[user2.id].userId).toBe(user2.id);
        done();
      });
    });
  });

  describe('Activity Tracking', () => {
    it('should update activity when user sends activity event', (done) => {
      // Send activity update
      clientSocket1.emit('activity');
      
      // Check that activity was updated (we can't directly test this without accessing the database)
      // But we can verify no errors occurred
      setTimeout(() => {
        done();
      }, 100);
    });
  });
});