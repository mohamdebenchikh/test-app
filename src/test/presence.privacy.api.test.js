/**
 * @fileoverview Integration tests for presence privacy API endpoints.
 * @module test/presence.privacy.api
 */

const request = require('supertest');
const app = require('../../index');
const { User, UserSession, sequelize } = require('../models');
const { generateToken } = require('../utils/jwt');

describe('Presence Privacy API Integration Tests', () => {
  let testUser1, testUser2, testUser3;
  let token1, token2, token3;

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
      online_status: 'online',
      city_id: 'test-city-1'
    });

    testUser2 = await User.create({
      name: 'Test User 2',
      email: 'test2@example.com',
      password: 'hashedpassword',
      role: 'client',
      show_online_status: false, // Privacy enabled
      online_status: 'online',
      city_id: 'test-city-1'
    });

    testUser3 = await User.create({
      name: 'Test User 3',
      email: 'test3@example.com',
      password: 'hashedpassword',
      role: 'provider',
      show_online_status: true,
      online_status: 'dnd',
      custom_status_message: 'In a meeting',
      city_id: 'test-city-1'
    });

    // Generate tokens
    token1 = generateToken(testUser1.id);
    token2 = generateToken(testUser2.id);
    token3 = generateToken(testUser3.id);
  });

  afterEach(async () => {
    await UserSession.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/presence/users/:userId', () => {
    test('should return limited presence info for privacy-disabled users', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUser2.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.online_status).toBe('offline');
      expect(response.body.last_seen).toBeNull();
      expect(response.body.last_seen_text).toBe('Last seen recently');
      expect(response.body.show_status).toBe(false);
    });

    test('should return full presence info for own requests', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUser2.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(response.body.online_status).toBe('online');
      expect(response.body.show_status).toBe(false);
      expect(response.body.last_seen).not.toBeNull();
    });

    test('should return limited info for DND users', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUser3.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.online_status).toBe('offline');
      expect(response.body.last_seen_text).toBe('Last seen recently');
    });

    test('should work without authentication for public presence', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUser1.id}`)
        .expect(200);

      expect(response.body.online_status).toBe('online');
      expect(response.body.show_status).toBe(true);
    });
  });

  describe('PATCH /api/presence/status', () => {
    test('should set DND status successfully', async () => {
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          status: 'dnd',
          message: 'In an important meeting'
        })
        .expect(200);

      expect(response.body.status).toBe('dnd');
      expect(response.body.custom_message).toBe('In an important meeting');

      // Verify user is updated in database
      const updatedUser = await User.findByPk(testUser1.id);
      expect(updatedUser.online_status).toBe('dnd');
      expect(updatedUser.custom_status_message).toBe('In an important meeting');
    });

    test('should set Away status successfully', async () => {
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          status: 'away',
          message: 'At lunch'
        })
        .expect(200);

      expect(response.body.status).toBe('away');
      expect(response.body.custom_message).toBe('At lunch');
    });

    test('should reject invalid status values', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          status: 'invalid_status'
        })
        .expect(400);
    });

    test('should reject custom messages over 100 characters', async () => {
      const longMessage = 'a'.repeat(101);
      
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          status: 'away',
          message: longMessage
        })
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .patch('/api/presence/status')
        .send({
          status: 'away'
        })
        .expect(401);
    });
  });

  describe('PATCH /api/presence/settings', () => {
    test('should update privacy settings successfully', async () => {
      const response = await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          show_online_status: false
        })
        .expect(200);

      expect(response.body.message).toBe('Presence settings updated successfully');
      expect(response.body.settings.show_online_status).toBe(false);

      // Verify user is updated in database
      const updatedUser = await User.findByPk(testUser1.id);
      expect(updatedUser.show_online_status).toBe(false);
    });

    test('should reject invalid privacy settings', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          invalid_setting: true
        })
        .expect(500); // Should throw error from service
    });

    test('should validate show_online_status as boolean', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          show_online_status: 'invalid'
        })
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .send({
          show_online_status: false
        })
        .expect(401);
    });
  });

  describe('GET /api/presence/online', () => {
    test('should exclude privacy-disabled users from results', async () => {
      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const privateUser = response.body.users.find(u => u.id === testUser2.id);
      expect(privateUser).toBeUndefined();
    });

    test('should include privacy-enabled users in results', async () => {
      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const publicUser = response.body.users.find(u => u.id === testUser1.id);
      expect(publicUser).toBeDefined();
      expect(publicUser.presence.show_status).toBe(true);
    });

    test('should exclude DND users from results', async () => {
      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const dndUser = response.body.users.find(u => u.id === testUser3.id);
      expect(dndUser).toBeUndefined();
    });

    test('should apply role filter correctly', async () => {
      const response = await request(app)
        .get('/api/presence/online?role=provider')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      response.body.users.forEach(user => {
        expect(user.role).toBe('provider');
      });
    });

    test('should apply city filter correctly', async () => {
      const response = await request(app)
        .get('/api/presence/online?city_id=test-city-1')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      response.body.users.forEach(user => {
        expect(user.city_id).toBe('test-city-1');
      });
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/presence/online')
        .expect(401);
    });
  });

  describe('Privacy Controls in User Model Methods', () => {
    test('should return privacy-aware last seen text', async () => {
      // Test with privacy disabled user
      const user2 = await User.findByPk(testUser2.id);
      const lastSeenText = user2.getLastSeenText(testUser1.id);
      expect(lastSeenText).toBe('Last seen recently');
    });

    test('should return full last seen text for own requests', async () => {
      const user2 = await User.findByPk(testUser2.id);
      const lastSeenText = user2.getLastSeenText(testUser2.id);
      expect(lastSeenText).not.toBe('Last seen recently');
    });

    test('should return DND status for own requests', async () => {
      const user3 = await User.findByPk(testUser3.id);
      const lastSeenText = user3.getLastSeenText(testUser3.id);
      expect(lastSeenText).toBe('Do Not Disturb');
    });

    test('should return Away status with custom message', async () => {
      await testUser1.update({ 
        online_status: 'away', 
        custom_status_message: 'At lunch' 
      });
      
      const user1 = await User.findByPk(testUser1.id);
      const lastSeenText = user1.getLastSeenText();
      expect(lastSeenText).toBe('Away - At lunch');
    });
  });
});