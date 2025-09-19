/**
 * @fileoverview Focused tests for portfolio routes authentication and authorization.
 * @module test/portfolio.routes.auth
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../index');
const { generateToken } = require('../utils/jwt');
const { sequelize } = require('../models');

describe('Portfolio Routes Authentication and Authorization', () => {
  let providerToken;
  let clientToken;
  let adminToken;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  beforeEach(() => {
    // Generate tokens for different roles
    providerToken = generateToken({
      sub: '123e4567-e89b-12d3-a456-426614174001',
      role: 'provider',
      language: 'en'
    });
    
    clientToken = generateToken({
      sub: '123e4567-e89b-12d3-a456-426614174002',
      role: 'client',
      language: 'en'
    });
    
    adminToken = generateToken({
      sub: '123e4567-e89b-12d3-a456-426614174003',
      role: 'admin',
      language: 'en'
    });
  });

  describe('Authentication Requirements', () => {
    const protectedEndpoints = [
      { method: 'post', path: '/api/users/profile/portfolio' },
      { method: 'get', path: '/api/users/profile/portfolio' },
      { method: 'get', path: '/api/users/profile/portfolio/stats' },
      { method: 'put', path: '/api/users/profile/portfolio/order' },
      { method: 'put', path: '/api/users/profile/portfolio/123e4567-e89b-12d3-a456-426614174010' },
      { method: 'delete', path: '/api/users/profile/portfolio/123e4567-e89b-12d3-a456-426614174010' }
    ];

    protectedEndpoints.forEach(endpoint => {
      it(`should require authentication for ${endpoint.method.toUpperCase()} ${endpoint.path}`, async () => {
        const res = await request(app)
          [endpoint.method](endpoint.path)
          .send({});

        expect(res.status).toBe(httpStatus.UNAUTHORIZED);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Access token is required');
      });
    });
  });

  describe('Provider Role Authorization', () => {
    const providerOnlyEndpoints = [
      { method: 'post', path: '/api/users/profile/portfolio' },
      { method: 'get', path: '/api/users/profile/portfolio' },
      { method: 'get', path: '/api/users/profile/portfolio/stats' },
      { method: 'put', path: '/api/users/profile/portfolio/order' },
      { method: 'put', path: '/api/users/profile/portfolio/123e4567-e89b-12d3-a456-426614174010' },
      { method: 'delete', path: '/api/users/profile/portfolio/123e4567-e89b-12d3-a456-426614174010' }
    ];

    providerOnlyEndpoints.forEach(endpoint => {
      it(`should require provider role for ${endpoint.method.toUpperCase()} ${endpoint.path}`, async () => {
        const res = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${clientToken}`)
          .send({});

        expect(res.status).toBe(httpStatus.FORBIDDEN);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Insufficient permissions');
      });

      it(`should reject admin role for ${endpoint.method.toUpperCase()} ${endpoint.path}`, async () => {
        const res = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(httpStatus.FORBIDDEN);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Insufficient permissions');
      });
    });
  });

  describe('Public Endpoints', () => {
    it('should allow public access to portfolio viewing', async () => {
      const res = await request(app)
        .get('/api/users/123e4567-e89b-12d3-a456-426614174001/portfolio');

      // Should not be unauthorized or forbidden
      expect(res.status).not.toBe(httpStatus.UNAUTHORIZED);
      expect(res.status).not.toBe(httpStatus.FORBIDDEN);
    });
  });

  describe('Request Validation', () => {
    it('should validate UUID parameters', async () => {
      const res = await request(app)
        .get('/api/users/invalid-uuid/portfolio');

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('should validate request body for image order update', async () => {
      const res = await request(app)
        .put('/api/users/profile/portfolio/order')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ imageOrders: 'invalid' });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('should validate description length', async () => {
      const res = await request(app)
        .put('/api/users/profile/portfolio/123e4567-e89b-12d3-a456-426614174010')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ description: 'a'.repeat(1001) });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });
  });

  describe('Token Validation', () => {
    it('should reject invalid tokens', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid or expired token');
    });

    it('should reject malformed authorization headers', async () => {
      const res = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', 'InvalidFormat token');

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Access token is required');
    });
  });

  describe('Route Error Handling', () => {
    it('should handle portfolio-specific errors with proper format', async () => {
      // Test that the error handler middleware is properly applied
      const res = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', Buffer.from('fake-image'), 'test.txt'); // Wrong file type

      // Should handle the error gracefully
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });
});