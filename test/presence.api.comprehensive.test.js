/**
 * @fileoverview Comprehensive API endpoint tests for presence system
 * Tests all presence-related API endpoints with various scenarios
 */

const request = require('supertest');
const app = require('../index');
const { User, UserSession, City, Service, ProviderService, sequelize } = require('../src/models');
const { generateToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');
const presenceService = require('../src/services/presence.service');

describe('Comprehensive Presence API Tests', () => {
  let testUsers = {};
  let tokens = {};
  let testCity;
  let testService;

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

    // Create comprehensive test users
    const hashedPassword = await hashPassword('password123');
    
    testUsers.provider1 = await User.create({
      name: 'Provider 1',
      email: 'provider1@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id,
      show_online_status: true,
      online_status: 'online'
    });

    testUsers.provider2 = await User.create({
      name: 'Provider 2',
      email: 'provider2@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id,
      show_online_status: false, // Privacy disabled
      online_status: 'away',
      custom_status_message: 'At lunch'
    });

    testUsers.client1 = await User.create({
      name: 'Client 1',
      email: 'client1@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: testCity.id,
      show_online_status: true,
      online_status: 'dnd',
      custom_status_message: 'In a meeting'
    });

    testUsers.admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      city_id: testCity.id,
      show_online_status: true
    });

    // Associate providers with service
    await ProviderService.bulkCreate([
      { user_id: testUsers.provider1.id, service_id: testService.id },
      { user_id: testUsers.provider2.id, service_id: testService.id }
    ]);

    // Generate tokens
    Object.keys(testUsers).forEach(key => {
      tokens[key] = generateToken(testUsers[key].id);
    });
  });

  afterAll(async () => {
    await UserSession.destroy({ where: {} });
    await ProviderService.destroy({ where: {} });
    await User.destroy({ where: {} });
    await Service.destroy({ where: {} });
    await City.destroy({ where: {} });
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await UserSession.destroy({ where: {} });
  });

  describe('GET /api/presence/users/:userId', () => {
    test('should return complete presence information for public users', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUsers.provider1.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUsers.provider1.id,
        online_status: 'online',
        show_status: true,
        last_seen: expect.any(String),
        last_seen_text: expect.any(String)
      });
    });

    test('should return limited information for privacy-disabled users', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUsers.provider2.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUsers.provider2.id,
        online_status: 'offline', // Should appear offline due to privacy
        show_status: false,
        last_seen: null,
        last_seen_text: 'Last seen recently'
      });
    });

    test('should return full information for own user', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUsers.provider2.id}`)
        .set('Authorization', `Bearer ${tokens.provider2}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUsers.provider2.id,
        online_status: 'away',
        show_status: false,
        custom_message: 'At lunch'
      });
    });

    test('should handle DND users correctly', async () => {
      const response = await request(app)
        .get(`/api/presence/users/${testUsers.client1.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUsers.client1.id,
        online_status: 'offline', // DND appears as offline to others
        last_seen_text: 'Last seen recently'
      });
    });

    test('should return 400 for invalid user ID', async () => {
      await request(app)
        .get('/api/presence/users/invalid-id')
        .expect(400);
    });

    test('should return 500 for non-existent user', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .get(`/api/presence/users/${fakeId}`)
        .expect(500);
    });
  });

  describe('PATCH /api/presence/status', () => {
    test('should update status to online', async () => {
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ status: 'online' })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Status updated successfully',
        status: 'online',
        custom_message: null
      });

      // Verify in database
      const user = await User.findByPk(testUsers.provider1.id);
      expect(user.online_status).toBe('online');
    });

    test('should update status to away with custom message', async () => {
      const customMessage = 'Gone for coffee';
      
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away',
          message: customMessage
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Status updated successfully',
        status: 'away',
        custom_message: customMessage
      });
    });

    test('should update status to DND', async () => {
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.client1}`)
        .send({ 
          status: 'dnd',
          message: 'Important meeting'
        })
        .expect(200);

      expect(response.body.status).toBe('dnd');
    });

    test('should clear custom message when setting to online', async () => {
      // First set away with message
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away',
          message: 'Away message'
        });

      // Then set to online
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ status: 'online' })
        .expect(200);

      expect(response.body.custom_message).toBeNull();
    });

    test('should validate status enum values', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });

    test('should validate custom message length', async () => {
      const longMessage = 'a'.repeat(101);
      
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away',
          message: longMessage
        })
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .patch('/api/presence/status')
        .send({ status: 'away' })
        .expect(401);
    });

    test('should handle empty message', async () => {
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away',
          message: ''
        })
        .expect(200);

      expect(response.body.custom_message).toBe('');
    });
  });

  describe('GET /api/presence/settings', () => {
    test('should return user presence settings', async () => {
      const response = await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        show_online_status: true,
        online_status: expect.any(String)
      });
    });

    test('should return privacy-disabled user settings', async () => {
      const response = await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider2}`)
        .expect(200);

      expect(response.body.show_online_status).toBe(false);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/presence/settings')
        .expect(401);
    });
  });

  describe('PATCH /api/presence/settings', () => {
    test('should enable online status visibility', async () => {
      const response = await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider2}`)
        .send({ show_online_status: true })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Presence settings updated successfully',
        show_online_status: true
      });

      // Verify in database
      const user = await User.findByPk(testUsers.provider2.id);
      expect(user.show_online_status).toBe(true);
    });

    test('should disable online status visibility', async () => {
      const response = await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ show_online_status: false })
        .expect(200);

      expect(response.body.show_online_status).toBe(false);
    });

    test('should validate boolean values', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ show_online_status: 'not_boolean' })
        .expect(400);
    });

    test('should reject invalid settings', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ invalid_setting: true })
        .expect(500);
    });

    test('should require authentication', async () => {
      await request(app)
        .patch('/api/presence/settings')
        .send({ show_online_status: false })
        .expect(401);
    });
  });

  describe('GET /api/presence/online', () => {
    beforeEach(async () => {
      // Set up some users as online
      await presenceService.setUserOnline(testUsers.provider1.id, 'socket-1');
      await presenceService.setUserOnline(testUsers.admin.id, 'socket-2');
    });

    test('should return list of online users', async () => {
      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${tokens.client1}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThan(0);

      // Check user structure
      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('presence');
        expect(user).toHaveProperty('last_seen_text');
        expect(user).toHaveProperty('is_online');
      }
    });

    test('should filter by role', async () => {
      const response = await request(app)
        .get('/api/presence/online?role=provider')
        .set('Authorization', `Bearer ${tokens.client1}`)
        .expect(200);

      response.body.users.forEach(user => {
        expect(user.role).toBe('provider');
      });
    });

    test('should filter by city', async () => {
      const response = await request(app)
        .get('/api/presence/online?city_id=' + testCity.id)
        .set('Authorization', `Bearer ${tokens.client1}`)
        .expect(200);

      response.body.users.forEach(user => {
        expect(user.city_id).toBe(testCity.id);
      });
    });

    test('should exclude privacy-disabled users', async () => {
      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${tokens.client1}`)
        .expect(200);

      const privateUser = response.body.users.find(u => u.id === testUsers.provider2.id);
      expect(privateUser).toBeUndefined();
    });

    test('should exclude DND users', async () => {
      const response = await request(app)
        .get('/api/presence/online')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .expect(200);

      const dndUser = response.body.users.find(u => u.id === testUsers.client1.id);
      expect(dndUser).toBeUndefined();
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/presence/online?limit=1&offset=0')
        .set('Authorization', `Bearer ${tokens.client1}`)
        .expect(200);

      expect(response.body.users.length).toBeLessThanOrEqual(1);
    });

    test('should validate role parameter', async () => {
      await request(app)
        .get('/api/presence/online?role=invalid_role')
        .set('Authorization', `Bearer ${tokens.client1}`)
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/presence/online')
        .expect(401);
    });
  });

  describe('POST /api/presence/activity', () => {
    test('should update user activity timestamp', async () => {
      const response = await request(app)
        .post('/api/presence/activity')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .expect(200);

      expect(response.body.message).toBe('Activity updated successfully');

      // Verify activity was updated
      const user = await User.findByPk(testUsers.provider1.id);
      expect(user.last_activity).toBeTruthy();
    });

    test('should handle rapid activity updates', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/presence/activity')
            .set('Authorization', `Bearer ${tokens.provider1}`)
        );
      }

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/presence/activity')
        .expect(401);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON in request body', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    test('should handle missing request body', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .expect(400);
    });

    test('should handle invalid authorization header', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', 'Invalid Bearer token')
        .send({ status: 'away' })
        .expect(401);
    });

    test('should handle expired tokens gracefully', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJleHAiOjE2MDAwMDAwMDB9.invalid';
      
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ status: 'away' })
        .expect(401);
    });

    test('should handle database connection errors', async () => {
      // Mock database error
      const originalFindByPk = User.findByPk;
      User.findByPk = jest.fn().mockRejectedValue(new Error('Database connection error'));

      try {
        await request(app)
          .get(`/api/presence/users/${testUsers.provider1.id}`)
          .expect(500);
      } finally {
        // Restore original method
        User.findByPk = originalFindByPk;
      }
    });

    test('should handle concurrent requests to same endpoint', async () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get(`/api/presence/users/${testUsers.provider1.id}`)
        );
      }

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.userId).toBe(testUsers.provider1.id);
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    test('should handle multiple rapid requests from same user', async () => {
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/presence/activity')
            .set('Authorization', `Bearer ${tokens.provider1}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Most requests should succeed (rate limiting might kick in)
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(10);
    });

    test('should validate input sanitization', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away',
          message: maliciousInput
        })
        .expect(200);

      // Message should be stored as-is (sanitization happens on output)
      expect(response.body.custom_message).toBe(maliciousInput);
    });

    test('should handle SQL injection attempts', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${tokens.provider1}`)
        .send({ 
          status: 'away',
          message: sqlInjection
        })
        .expect(200);

      // Database should still be intact
      const user = await User.findByPk(testUsers.provider1.id);
      expect(user).toBeTruthy();
    });
  });
});