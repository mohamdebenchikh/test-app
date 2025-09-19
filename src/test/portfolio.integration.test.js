const request = require('supertest');
const app = require('../../index');
const { User, ProviderPortfolio, sequelize } = require('../models');
const { createTestImage } = require('./fixtures/createTestImage');
const { hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

describe('Portfolio API Integration Tests', () => {
  let providerToken;
  let clientToken;
  let providerId;
  let clientId;
  let portfolioImageId;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });

    // Create test provider directly in database
    const providerData = {
      name: 'Test Provider',
      email: 'provider@test.com',
      password: await hashPassword('Password123!'),
      role: 'provider'
    };
    
    const provider = await User.create(providerData);
    providerId = provider.id;
    
    // Generate token for the provider
    const providerPayload = {
      sub: provider.id,
      language: provider.language,
      role: provider.role
    };
    providerToken = generateToken(providerPayload);

    // Create test client directly in database
    const clientData = {
      name: 'Test Client',
      email: 'client@test.com',
      password: await hashPassword('Password123!'),
      role: 'client'
    };
    
    const client = await User.create(clientData);
    clientId = client.id;
    
    // Generate token for the client
    const clientPayload = {
      sub: client.id,
      language: client.language,
      role: client.role
    };
    clientToken = generateToken(clientPayload);
  });

  afterAll(async () => {
    // Clean up test data
    if (providerId) {
      await ProviderPortfolio.destroy({ where: { provider_id: providerId } });
    }
    if (providerId || clientId) {
      await User.destroy({ where: { id: [providerId, clientId].filter(Boolean) } });
    }
    // Close database connection
    await sequelize.close();
  });

  describe('POST /api/users/profile/portfolio', () => {
    it('should reject upload without authentication', async () => {
      const testImageBuffer = await createTestImage(800, 600, 'jpeg');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .attach('image', testImageBuffer, 'test-image.jpg');

      expect(response.status).toBe(401);
    });

    it('should reject upload from non-provider', async () => {
      const testImageBuffer = await createTestImage(800, 600, 'jpeg');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${clientToken}`)
        .attach('image', testImageBuffer, 'test-image.jpg');

      expect(response.status).toBe(403);
    });

    it('should reject upload without image file', async () => {
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .field('description', 'Test without image');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/profile/portfolio', () => {
    it('should reject access without authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile/portfolio');

      expect(response.status).toBe(401);
    });

    it('should reject access from non-provider', async () => {
      const response = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(403);
    });

    it('should get own portfolio successfully', async () => {
      const response = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('portfolio');
      expect(response.body.data.portfolio).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/users/:userId/portfolio', () => {
    it('should get public portfolio successfully', async () => {
      const response = await request(app)
        .get(`/api/users/${providerId}/portfolio`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('portfolio');
      expect(response.body.data.portfolio).toBeInstanceOf(Array);
    });

    it('should validate userId format', async () => {
      const response = await request(app)
        .get('/api/users/invalid-uuid/portfolio');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/profile/portfolio/stats', () => {
    it('should reject access without authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile/portfolio/stats');

      expect(response.status).toBe(401);
    });

    it('should reject access from non-provider', async () => {
      const response = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(response.status).toBe(403);
    });

    it('should get portfolio statistics successfully', async () => {
      const response = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalImages');
      expect(response.body.data).toHaveProperty('maxImages');
      expect(response.body.data).toHaveProperty('remainingSlots');
      expect(response.body.data).toHaveProperty('maxFileSize');
      expect(response.body.data).toHaveProperty('allowedTypes');
    });
  });
});