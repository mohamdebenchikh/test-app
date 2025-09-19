const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const app = require('../index');
const { sequelize, User, Conversation, Message } = require('../src/models');
const { userService } = require('../src/services');

describe('Chat Integration Test', () => {
  let userA, userB, tokenA, tokenB, conversation;

  beforeAll(async () => {
    // Drop and recreate tables to ensure schema matches our models
    await sequelize.getQueryInterface().dropTable('Messages', { cascade: true });
    await sequelize.getQueryInterface().dropTable('Conversations', { cascade: true });
    await sequelize.getQueryInterface().dropTable('users', { cascade: true });
    
    await sequelize.sync({ force: true });

    // Create users using the userService to ensure passwords are hashed
    userA = await userService.createUser({ name: 'User A', email: 'usera@test.com', password: 'password', role: 'client' });
    userB = await userService.createUser({ name: 'User B', email: 'userb@test.com', password: 'password', role: 'client' });

    // Debug logs to see the user objects
    console.log('User A:', userA.toJSON());
    console.log('User B:', userB.toJSON());

    // Get tokens
    const resA = await request(app).post('/api/auth/login').send({ email: 'usera@test.com', password: 'password' });
    tokenA = resA.body.tokens.access.token;
    const resB = await request(app).post('/api/auth/login').send({ email: 'userb@test.com', password: 'password' });
    tokenB = resB.body.tokens.access.token;

    // Create a conversation and a message for API tests
    conversation = await Conversation.create({ userOneId: userA.id, userTwoId: userB.id });
    console.log('Conversation:', conversation.toJSON());
    await Message.create({ conversationId: conversation.id, senderId: userA.id, content: 'Hello User B' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Chat REST API', () => {
    it('GET /api/chat/conversations - should get conversations for User A', async () => {
      const res = await request(app)
        .get('/api/chat/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].messages[0].content).toBe('Hello User B');
    });

    it('GET /api/chat/conversations/:conversationId/messages - should get messages for the conversation', async () => {
      const res = await request(app)
        .get(`/api/chat/conversations/${conversation.id}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].content).toBe('Hello User B');
    });

    it('GET /api/chat/conversations - should return 401 if not authenticated', async () => {
      await request(app).get('/api/chat/conversations').expect(401);
    });
  });

  describe('Chat WebSocket', () => {
    let clientSocketA, clientSocketB, httpServer;

    beforeAll((done) => {
      httpServer = createServer(app);
      const io = new Server(httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });
      
      // Initialize socket service
      require('../src/services/socket.service')(io);
      
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        console.log(`Test server listening on port ${port}`);
        
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
            console.log('Both clients connected');
            done();
          }
        };
        
        clientSocketA.on('connect', () => {
          console.log('Client A connected with id:', clientSocketA.id);
          checkDone();
        });
        
        clientSocketB.on('connect', () => {
          console.log('Client B connected with id:', clientSocketB.id);
          checkDone();
        });
        
        clientSocketA.on('connect_error', (error) => {
          console.error('Client A connection error:', error);
          done(error);
        });
        
        clientSocketB.on('connect_error', (error) => {
          console.error('Client B connection error:', error);
          done(error);
        });
        
        // Add error handlers
        clientSocketA.on('error', (error) => {
          console.error('Client A error:', error);
        });
        
        clientSocketB.on('error', (error) => {
          console.error('Client B error:', error);
        });
      });
      
      // Add error handler for the server
      httpServer.on('error', (error) => {
        console.error('HTTP server error:', error);
        done(error);
      });
    });

    afterAll(() => {
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

    it('should send and receive a message in real-time', (done) => {
      const messageContent = 'Hi there from User A';

      // Add a timeout to the test
      const timeout = setTimeout(() => {
        done(new Error('Test timeout: Message not received'));
      }, 10000);

      clientSocketB.on('newMessage', (message) => {
        clearTimeout(timeout);
        try {
          console.log('Client B received message:', message);
          expect(message.content).toBe(messageContent);
          expect(message.sender.id).toBe(userA.id);
          done();
        } catch (error) {
          done(error);
        }
      });

      // Also listen for errors
      clientSocketA.on('error', (error) => {
        console.error('Client A error during test:', error);
      });
      
      clientSocketB.on('error', (error) => {
        console.error('Client B error during test:', error);
      });

      console.log('Sending message from A to B');
      clientSocketA.emit('sendMessage', { recipientId: userB.id, content: messageContent }, (response) => {
        console.log('Client A received callback response:', response);
      });
    }, 15000); // Increase timeout to 15 seconds
  });
});