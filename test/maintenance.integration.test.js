/**
 * @fileoverview Integration tests for maintenance API endpoints.
 * @module test/maintenance.integration
 */

const request = require('supertest');
const httpStatus = require('http-status').default;
const app = require('../index');
const { User, UserSession, sequelize } = require('../src/models');
const { generateToken } = require('../src/utils/jwt');

describe('Maintenance API Integration Tests', () => {
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;

  beforeAll(async () => {
    // Sync database schema for tests
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up test data
    await UserSession.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create admin user (assuming admin role exists)
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'hashedpassword',
      role: 'admin', // This may need adjustment based on your role system
      active: true
    });

    // Create regular user
    regularUser = await User.create({
      name: 'Regular User',
      email: 'user@example.com',
      password: 'hashedpassword',
      role: 'provider',
      active: true
    });

    // Generate tokens
    adminToken = generateToken({ sub: adminUser.id, role: adminUser.role });
    regularToken = generateToken({ sub: regularUser.id, role: regularUser.role });
  });

  afterAll(async () => {
    // Close database connection
    await sequelize.close();
  });

  describe('GET /api/maintenance/metrics', () => {
    it('should return current metrics for admin', async () => {
      const response = await request(app)
        .get('/api/maintenance/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalActiveSessions');
      expect(response.body.data).toHaveProperty('concurrentUsers');
      expect(response.body.data).toHaveProperty('onlineUsers');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should deny access to non-admin users', async () => {
      await request(app)
        .get('/api/maintenance/metrics')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(httpStatus.FORBIDDEN);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/maintenance/metrics')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /api/maintenance/metrics/refresh', () => {
    it('should refresh metrics for admin', async () => {
      const response = await request(app)
        .post('/api/maintenance/metrics/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lastMetricsUpdate');
      expect(response.body.message).toBe('Metrics refreshed successfully');
    });
  });

  describe('GET /api/maintenance/sessions', () => {
    beforeEach(async () => {
      // Create test sessions
      await UserSession.create({
        user_id: adminUser.id,
        socket_id: 'admin-web-socket',
        device_type: 'web',
        is_active: true
      });

      await UserSession.create({
        user_id: regularUser.id,
        socket_id: 'user-mobile-socket',
        device_type: 'mobile',
        is_active: false
      });
    });

    it('should return session details with filters', async () => {
      const response = await request(app)
        .get('/api/maintenance/sessions?active=true&device_type=web')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].device_type).toBe('web');
      expect(response.body.data.sessions[0].is_active).toBe(true);
    });

    it('should validate query parameters', async () => {
      await request(app)
        .get('/api/maintenance/sessions?limit=2000') // Exceeds max limit
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /api/maintenance/health', () => {
    it('should return health check results', async () => {
      const response = await request(app)
        .get('/api/maintenance/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('issues');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/maintenance/cleanup/sessions', () => {
    beforeEach(async () => {
      // Create inactive session
      const inactiveTime = new Date(Date.now() - 15 * 60 * 1000);
      await UserSession.create({
        user_id: regularUser.id,
        socket_id: 'inactive-socket',
        device_type: 'web',
        connected_at: inactiveTime,
        last_ping: inactiveTime,
        is_active: true
      });
    });

    it('should clean up inactive sessions', async () => {
      const response = await request(app)
        .post('/api/maintenance/cleanup/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inactiveMinutes: 10 })
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cleanedSessions).toBeGreaterThan(0);
      expect(response.body.message).toContain('Cleaned up');
    });

    it('should validate request body', async () => {
      await request(app)
        .post('/api/maintenance/cleanup/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inactiveMinutes: 0 }) // Invalid value
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /api/maintenance/cleanup/old-data', () => {
    beforeEach(async () => {
      // Create old inactive session
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await UserSession.create({
        user_id: regularUser.id,
        socket_id: 'old-socket',
        device_type: 'web',
        connected_at: oldDate,
        last_ping: oldDate,
        is_active: false,
        createdAt: oldDate
      });
    });

    it('should remove old session data', async () => {
      const response = await request(app)
        .post('/api/maintenance/cleanup/old-data')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ olderThanDays: 7 })
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('removedSessions');
      expect(response.body.message).toContain('Removed');
    });
  });

  describe('GET /api/maintenance/scheduler/status', () => {
    it('should return scheduler status', async () => {
      const response = await request(app)
        .get('/api/maintenance/scheduler/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isRunning');
      expect(response.body.data).toHaveProperty('activeTasks');
      expect(response.body.data).toHaveProperty('taskCount');
    });
  });

  describe('POST /api/maintenance/scheduler/trigger/:taskName', () => {
    it('should trigger sessionCleanup task', async () => {
      const response = await request(app)
        .post('/api/maintenance/scheduler/trigger/sessionCleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cleanedSessions');
      expect(response.body.message).toContain('sessionCleanup executed successfully');
    });

    it('should trigger metricsCollection task', async () => {
      const response = await request(app)
        .post('/api/maintenance/scheduler/trigger/metricsCollection')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lastMetricsUpdate');
    });

    it('should trigger healthCheck task', async () => {
      const response = await request(app)
        .post('/api/maintenance/scheduler/trigger/healthCheck')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
    });

    it('should validate task name', async () => {
      await request(app)
        .post('/api/maintenance/scheduler/trigger/invalidTask')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /api/maintenance/config', () => {
    it('should return maintenance configuration', async () => {
      const response = await request(app)
        .get('/api/maintenance/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('INACTIVE_SESSION_MINUTES');
      expect(response.body.data).toHaveProperty('SESSION_CLEANUP_INTERVAL');
      expect(response.body.data).toHaveProperty('METRICS_COLLECTION_INTERVAL');
    });
  });
});