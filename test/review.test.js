const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../index');
const { User, Review, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Review routes', () => {
  // Sync database before running tests
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  // Close database connection after all tests
  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/reviews', () => {
    let clientAccessToken;
    let providerUser;

    beforeAll(async () => {
      // Create users with hashed passwords
      const hashedClientPassword = await hashPassword('password123');
      const hashedProviderPassword = await hashPassword('password123');
      
      await User.create({
        name: 'Client User',
        email: 'client@example.com',
        password: hashedClientPassword,
        role: 'client'
      });
      
      providerUser = await User.create({
        name: 'Provider User',
        email: 'provider@example.com',
        password: hashedProviderPassword,
        role: 'provider'
      });
      
      // Login client user
      const clientRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'client@example.com', password: 'password123' });
        
      clientAccessToken = clientRes.body.tokens.access.token;
    });

    test('should create a review when data is valid', async () => {
      const reviewData = {
        stars: 5,
        comment: 'Great service!',
        provider_id: providerUser.id
      };

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(reviewData);

      expect(res.status).toEqual(201);
      expect(res.body.stars).toEqual(reviewData.stars);
      expect(res.body.comment).toEqual(reviewData.comment);
      expect(res.body.provider_id).toEqual(providerUser.id);
      expect(res.body.client_id).toBeDefined();
    });

    test('should reject review with invalid stars', async () => {
      const reviewData = {
        stars: 6, // Invalid - should be 1-5
        comment: 'Great service!',
        provider_id: providerUser.id
      };

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${clientAccessToken}`)
        .send(reviewData);

      expect(res.status).toEqual(400);
    });
  });

  describe('GET /api/reviews/provider/:providerId', () => {
    let clientUser;
    let providerUser;

    beforeAll(async () => {
      // Create users with hashed passwords
      const hashedClientPassword = await hashPassword('password123');
      const hashedProviderPassword = await hashPassword('password123');
      
      clientUser = await User.create({
        name: 'Client User 2',
        email: 'client2@example.com',
        password: hashedClientPassword,
        role: 'client'
      });
      
      providerUser = await User.create({
        name: 'Provider User 2',
        email: 'provider2@example.com',
        password: hashedProviderPassword,
        role: 'provider'
      });
    });

    test('should get all reviews for a provider', async () => {
      // Create a review first
      const review = await Review.create({
        stars: 4,
        comment: 'Good service',
        client_id: clientUser.id,
        provider_id: providerUser.id
      });

      const res = await request(app)
        .get(`/api/reviews/provider/${providerUser.id}`);

      expect(res.status).toEqual(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toEqual(review.id);
      expect(res.body[0].stars).toEqual(review.stars);
      expect(res.body[0].comment).toEqual(review.comment);
      expect(res.body[0].client.id).toEqual(clientUser.id);
      expect(res.body[0].client.name).toEqual(clientUser.name);
    });
  });
});