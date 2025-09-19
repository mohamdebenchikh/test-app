/**
 * @fileoverview Tests for portfolio routes authentication and authorization.
 * @module test/portfolio.routes
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../index');
const { generateToken } = require('../utils/jwt');
const { ProviderPortfolio, User, sequelize } = require('../models');
const config = require('../config/config');
const { hashPassword } = require('../utils/password');

describe('Portfolio Routes Authentication and Authorization', () => {
  let providerUser;
  let clientUser;
  let adminUser;
  let providerToken;
  let clientToken;
  let adminToken;
  let portfolioImage;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  beforeEach(async () => {
    // Create test users
    providerUser = await User.create({
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'provider@test.com',
      password: await hashPassword('password123'),
      name: 'Provider User',
      role: 'provider',
      verify: true
    });

    clientUser = await User.create({
      id: '123e4567-e89b-12d3-a456-426614174002',
      email: 'client@test.com',
      password: await hashPassword('password123'),
      name: 'Client User',
      role: 'client',
      verify: true
    });

    adminUser = await User.create({
      id: '123e4567-e89b-12d3-a456-426614174003',
      email: 'admin@test.com',
      password: await hashPassword('password123'),
      name: 'Admin User',
      role: 'admin',
      verify: true
    });

    // Generate tokens
    providerToken = generateToken({
      sub: providerUser.id,
      role: providerUser.role,
      language: providerUser.language || 'en'
    });
    clientToken = generateToken({
      sub: clientUser.id,
      role: clientUser.role,
      language: clientUser.language || 'en'
    });
    adminToken = generateToken({
      sub: adminUser.id,
      role: adminUser.role,
      language: adminUser.language || 'en'
    });

    // Create a test portfolio image
    portfolioImage = await ProviderPortfolio.create({
      id: '123e4567-e89b-12d3-a456-426614174010',
      provider_id: providerUser.id,
      image_url: '/uploads/portfolio/test-image.jpg',
      thumbnail_url: '/uploads/portfolio/test-image-thumb.jpg',
      medium_url: '/uploads/portfolio/test-image-medium.jpg',
      description: 'Test portfolio image',
      display_order: 1,
      file_size: 1024000,
      mime_type: 'image/jpeg',
      original_filename: 'test-image.jpg'
    });
  });

  afterEach(async () => {
    await ProviderPortfolio.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('POST /api/users/profile/portfolio', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/users/profile/portfolio');

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.message).toBe('Access token is required');
    });

    it('should require provider role', async () => {
      const res = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should reject admin role for portfolio upload', async () => {
      const res = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should allow provider to upload with valid token', async () => {
      // Create a simple test image buffer
      const imageBuffer = Buffer.from('fake-image-data');
      
      const res = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', imageBuffer, 'test.jpg')
        .field('description', 'Test image description');

      // Should not be unauthorized or forbidden
      expect(res.status).not.toBe(httpStatus.UNAUTHORIZED);
      expect(res.status).not.toBe(httpStatus.FORBIDDEN);
    });

    it('should validate request body for description', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const res = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', imageBuffer, 'test.jpg')
        .field('description', 'a'.repeat(1001)); // Exceeds 1000 char limit

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /api/users/profile/portfolio', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Access token is required');
    });

    it('should require provider role', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should allow provider to access own portfolio', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
    });

    it('should validate query parameters', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio?limit=invalid')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /api/users/profile/portfolio/stats', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Access token is required');
    });

    it('should require provider role', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should allow provider to access portfolio stats', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/users/profile/portfolio/order', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/users/profile/portfolio/order')
        .send({ imageOrders: [] })
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Access token is required');
    });

    it('should require provider role', async () => {
      const res = await request(app)
        .put('/api/users/profile/portfolio/order')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ imageOrders: [] })
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should validate request body', async () => {
      const res = await request(app)
        .put('/api/users/profile/portfolio/order')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ imageOrders: 'invalid' })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should allow provider to update image order', async () => {
      const imageOrders = [{
        id: portfolioImage.id,
        display_order: 2
      }];

      const res = await request(app)
        .put('/api/users/profile/portfolio/order')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ imageOrders })
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/users/profile/portfolio/:imageId', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .put(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .send({ description: 'Updated description' })
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Access token is required');
    });

    it('should require provider role', async () => {
      const res = await request(app)
        .put(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ description: 'Updated description' })
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should validate imageId parameter', async () => {
      const res = await request(app)
        .put('/api/users/profile/portfolio/invalid-uuid')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ description: 'Updated description' })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should validate request body', async () => {
      const res = await request(app)
        .put(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ description: 'a'.repeat(1001) })
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should allow provider to update image description', async () => {
      const res = await request(app)
        .put(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ description: 'Updated description' })
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/users/profile/portfolio/:imageId', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Access token is required');
    });

    it('should require provider role', async () => {
      const res = await request(app)
        .delete(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toBe('Insufficient permissions');
    });

    it('should validate imageId parameter', async () => {
      const res = await request(app)
        .delete('/api/users/profile/portfolio/invalid-uuid')
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should allow provider to delete portfolio image', async () => {
      const res = await request(app)
        .delete(`/api/users/profile/portfolio/${portfolioImage.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/users/:userId/portfolio (Public)', () => {
    it('should not require authentication', async () => {
      const res = await request(app)
        .get(`/api/users/${providerUser.id}/portfolio`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
    });

    it('should validate userId parameter', async () => {
      const res = await request(app)
        .get('/api/users/invalid-uuid/portfolio')
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should validate query parameters', async () => {
      const res = await request(app)
        .get(`/api/users/${providerUser.id}/portfolio?limit=invalid`)
        .expect(httpStatus.BAD_REQUEST);
    });

    it('should allow access to public portfolio', async () => {
      const res = await request(app)
        .get(`/api/users/${providerUser.id}/portfolio`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Portfolio Error Handling', () => {
    it('should handle portfolio limit errors with specific error format', async () => {
      // Mock reaching portfolio limit by creating max images
      const maxImages = config.portfolio.limits.maxImages;
      const promises = [];
      
      for (let i = 0; i < maxImages; i++) {
        promises.push(ProviderPortfolio.create({
          id: `123e4567-e89b-12d3-a456-42661417400${i}`,
          provider_id: providerUser.id,
          image_url: `/uploads/portfolio/test-image-${i}.jpg`,
          thumbnail_url: `/uploads/portfolio/test-image-${i}-thumb.jpg`,
          medium_url: `/uploads/portfolio/test-image-${i}-medium.jpg`,
          description: `Test portfolio image ${i}`,
          display_order: i + 1,
          file_size: 1024000,
          mime_type: 'image/jpeg',
          original_filename: `test-image-${i}.jpg`
        }));
      }
      
      await Promise.all(promises);

      const imageBuffer = Buffer.from('fake-image-data');
      
      const res = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', imageBuffer, 'test.jpg')
        .field('description', 'Test image description');

      expect(res.status).toBe(httpStatus.CONFLICT);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Portfolio Limit Exceeded');
      expect(res.body.message).toContain('Portfolio limit reached');
    });

    it('should handle invalid token errors', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', 'Bearer invalid-token')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('should handle missing authorization header', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .expect(httpStatus.UNAUTHORIZED);

      expect(res.body.message).toBe('Access token is required');
    });
  });

  describe('Route-level Authorization Consistency', () => {
    it('should consistently require provider role for all management endpoints', async () => {
      const managementEndpoints = [
        { method: 'get', path: '/api/users/profile/portfolio' },
        { method: 'get', path: '/api/users/profile/portfolio/stats' },
        { method: 'put', path: '/api/users/profile/portfolio/order' },
        { method: 'put', path: `/api/users/profile/portfolio/${portfolioImage.id}` },
        { method: 'delete', path: `/api/users/profile/portfolio/${portfolioImage.id}` }
      ];

      for (const endpoint of managementEndpoints) {
        const res = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${clientToken}`)
          .send({});

        expect(res.status).toBe(httpStatus.FORBIDDEN);
        expect(res.body.message).toBe('Insufficient permissions');
      }
    });

    it('should allow provider access to all management endpoints', async () => {
      const managementEndpoints = [
        { method: 'get', path: '/api/users/profile/portfolio' },
        { method: 'get', path: '/api/users/profile/portfolio/stats' }
      ];

      for (const endpoint of managementEndpoints) {
        const res = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${providerToken}`);

        expect(res.status).not.toBe(httpStatus.UNAUTHORIZED);
        expect(res.status).not.toBe(httpStatus.FORBIDDEN);
      }
    });
  });
});