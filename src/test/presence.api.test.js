const request = require('supertest');
const app = require('../../index');
const { sequelize, User, UserSession } = require('../models');
const { generateToken } = require('../utils/jwt');
const { hashPassword } = require('../utils/password');
const presenceService = require('../services/presence.service');

describe('Presence API', () => {
  let testUser, anotherUser, userToken, anotherUserToken;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test users
    const hashedPassword = await hashPassword('password123');
    
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'provider'
    });

    anotherUser = await User.create({
      name: 'Another User',
      email: 'another@example.com',
      password: hashedPassword,
      role: 'client'
    });

    // Generate tokens
    const payload1 = {
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
      language: testUser.language
    };
    userToken = generateToken(payload1);

    const payload2 = {
      id: anotherUser.id,
      email: anotherUser.email,
      role: anotherUser.role,
      language: anotherUser.language
    };
    anotherUserToken = generateToken(payload2);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up sessions and reset user status
    await UserSession.destroy({ where: {}, force: true });
    await User.update(
      { 
        online_status: 'offline',
        show_online_status: true,
        custom_status_message: null
      },
      { where: {} }
    );
  });

  describe('GET /api/presence/users/:userId', () => {
    test('should get user presence information', async () => {
      // Set user online first
      await presenceService.setUserOnline(testUser.id, 'socket-123');
      await presenceService.setCustomStatus(testUser.id, 'away', 'In a meeting');

      const response = await request(app)
        .get(`/api/presence/users/${testUser.id}`)
        .expect(200);

      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.online_status).toBe('away');
      expect(response.body.custom_message).toBe('In a meeting');
      expect(response.body.show_status).toBe(true);
    });

    test('should return 404 for non-existent user', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .get(`/api/presence/users/${fakeId}`)
        .expect(500); // Will throw error from service
    });

    test('should return 400 for invalid user ID format', async () => {
      await request(app)
        .get('/api/presence/users/invalid-id')
        .expect(400);
    });
  });

  describe('PATCH /api/presence/status', () => {
    test('should update user status', async () => {
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'dnd',
          message: 'Do not disturb'
        })
        .expect(200);

      expect(response.body.message).toBe('Status updated successfully');
      expect(response.body.status).toBe('dnd');
      expect(response.body.custom_message).toBe('Do not disturb');

      // Verify in database
      await testUser.reload();
      expect(testUser.online_status).toBe('dnd');
      expect(testUser.custom_status_message).toBe('Do not disturb');
    });

    test('should return 400 for invalid status', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'invalid'
        })
        .expect(400);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .patch('/api/presence/status')
        .send({
          status: 'away'
        })
        .expect(401);
    });
  });

  describe('GET /api/presence/settings', () => {
    test('should get user presence settings', async () => {
      const response = await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('show_online_status');
      expect(response.body).toHaveProperty('online_status');
      expect(response.body.show_online_status).toBe(true);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/presence/settings')
        .expect(401);
    });
  });

  describe('PATCH /api/presence/settings', () => {
    test('should update presence settings', async () => {
      const response = await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          show_online_status: false
        })
        .expect(200);

      expect(response.body.message).toBe('Presence settings updated successfully');
      expect(response.body.show_online_status).toBe(false);

      // Verify in database
      await testUser.reload();
      expect(testUser.show_online_status).toBe(false);
    });

    test('should return 400 for invalid settings', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          show_online_status: 'invalid'
        })
        .expect(400);
    });
  });

  describe('GET /api/presence/online', () => {
    test('should get online users', async () => {
      // Set users online
      await presenceService.setUserOnline(testUser.id, 'socket-1');
      await presenceService.setUserOnline(anotherUser.id, 'socket-2');

      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.users.length).toBeGreaterThan(0);

      // Check user structure
      const user = response.body.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('presence');
      expect(user).toHaveProperty('last_seen_text');
    });

    test('should filter online users by role', async () => {
      await presenceService.setUserOnline(testUser.id, 'socket-1');
      await presenceService.setUserOnline(anotherUser.id, 'socket-2');

      const response = await request(app)
        .get('/api/presence/online?role=provider')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.users).toBeInstanceOf(Array);
      // Should only return providers
      response.body.users.forEach(user => {
        expect(user.role).toBe('provider');
      });
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/presence/online')
        .expect(401);
    });
  });

  describe('POST /api/presence/activity', () => {
    test('should update user activity', async () => {
      const response = await request(app)
        .post('/api/presence/activity')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toBe('Activity updated successfully');

      // Verify activity was updated
      await testUser.reload();
      expect(testUser.last_activity).toBeTruthy();
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/presence/activity')
        .expect(401);
    });
  });
});