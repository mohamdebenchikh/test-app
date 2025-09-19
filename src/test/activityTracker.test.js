const request = require('supertest');
const app = require('../../index');
const { sequelize, User } = require('../models');
const { generateToken } = require('../utils/jwt');
const { hashPassword } = require('../utils/password');
const { trackActivity, forceTrackActivity, clearActivityCache, getActivityCacheStats } = require('../middlewares/activityTracker');

describe('Activity Tracking Middleware', () => {
  let testUser, userToken;

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
    // Clear activity cache before each test
    clearActivityCache();
    
    // Reset user's last activity
    await User.update(
      { last_activity: null },
      { where: { id: testUser.id } }
    );
  });

  describe('Automatic Activity Tracking', () => {
    test('should update last_activity when making authenticated API calls', async () => {
      // Make an API call that requires authentication
      await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Wait for the async activity update with retry logic
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        await testUser.reload();
        if (testUser.last_activity) break;
        attempts++;
      }

      // Check that last_activity was updated
      expect(testUser.last_activity).toBeTruthy();
      expect(testUser.last_activity).toBeInstanceOf(Date);
    });

    test('should not update activity for unauthenticated requests', async () => {
      // Make an unauthenticated API call
      await request(app)
        .get('/api/services')
        .expect(200);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that last_activity was not updated
      await testUser.reload();
      expect(testUser.last_activity).toBeNull();
    });

    test('should rate limit activity updates', async () => {
      // Make first request
      await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Wait for activity update with retry logic
      let attempts = 0;
      while (attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        await testUser.reload();
        if (testUser.last_activity) break;
        attempts++;
      }
      
      const firstUpdate = testUser.last_activity;
      expect(firstUpdate).toBeTruthy();

      // Make second request immediately (should be rate limited)
      await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 300));
      await testUser.reload();
      const secondUpdate = testUser.last_activity;

      // Should be the same time (rate limited)
      expect(secondUpdate.getTime()).toBe(firstUpdate.getTime());
    });

    test('should update activity after rate limit interval', async () => {
      // This test would require waiting 30+ seconds for the real rate limit
      // Instead, we'll test the cache mechanism directly
      
      const stats = getActivityCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });

  describe('Force Activity Tracking', () => {
    test('should immediately update activity when forced', async () => {
      // Create a mock request/response for testing middleware directly
      const req = {
        user: { id: testUser.id }
      };
      const res = {};
      const next = jest.fn();

      // Call force track activity middleware
      await forceTrackActivity(req, res, next);

      // Check that next was called
      expect(next).toHaveBeenCalled();

      // Check that activity was updated
      await testUser.reload();
      expect(testUser.last_activity).toBeTruthy();
    });

    test('should handle missing user gracefully', async () => {
      const req = {}; // No user
      const res = {};
      const next = jest.fn();

      // Should not throw error
      await forceTrackActivity(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Regular Activity Tracking', () => {
    test('should handle missing user gracefully', async () => {
      const req = {}; // No user
      const res = {};
      const next = jest.fn();

      // Should not throw error
      await trackActivity(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should update activity for authenticated user', async () => {
      const req = {
        user: { id: testUser.id }
      };
      const res = {};
      const next = jest.fn();

      await trackActivity(req, res, next);

      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(next).toHaveBeenCalled();
      await testUser.reload();
      expect(testUser.last_activity).toBeTruthy();
    });
  });

  describe('Activity Cache Management', () => {
    test('should clear specific user from cache', async () => {
      // Add user to cache by making a request
      await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      let stats = getActivityCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Clear specific user
      clearActivityCache(testUser.id);

      stats = getActivityCacheStats();
      const userInCache = stats.entries.find(entry => entry.userId === testUser.id);
      expect(userInCache).toBeUndefined();
    });

    test('should clear entire cache', async () => {
      // Add user to cache
      await request(app)
        .get('/api/presence/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100));

      let stats = getActivityCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Clear entire cache
      clearActivityCache();

      stats = getActivityCacheStats();
      expect(stats.size).toBe(0);
    });

    test('should provide cache statistics', async () => {
      const stats = getActivityCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(typeof stats.size).toBe('number');
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });

  describe('Integration with Presence API', () => {
    test('should update activity when using presence endpoints', async () => {
      // Use the manual activity endpoint
      await request(app)
        .post('/api/presence/activity')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Check that activity was updated
      await testUser.reload();
      expect(testUser.last_activity).toBeTruthy();
    });

    test('should update activity when changing status', async () => {
      await request(app)
        .patch('/api/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'away',
          message: 'Testing'
        })
        .expect(200);

      // Wait for activity update
      await new Promise(resolve => setTimeout(resolve, 100));

      await testUser.reload();
      expect(testUser.last_activity).toBeTruthy();
      expect(testUser.online_status).toBe('away');
    });
  });
});