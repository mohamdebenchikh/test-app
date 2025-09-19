const request = require('supertest');
const app = require('../index');
const { sequelize, User } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { generateToken } = require('../src/utils/jwt');

describe('User Avatar API', () => {
  let userToken;
  let testUser;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Create a test user
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: await hashPassword('Password123!'),
      role: 'client'
    };
    
    testUser = await User.create(userData);
    
    // Generate token for the user using the same method as the auth middleware
    const payload = {
      sub: testUser.id,
      language: testUser.language
    };
    userToken = generateToken(payload);
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('PATCH /api/users/profile/avatar - Update user avatar', () => {
    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .patch('/api/users/profile/avatar')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Access token is required');
    });

    it('should return 400 if no file is provided', async () => {
      const response = await request(app)
        .patch('/api/users/profile/avatar')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'No file uploaded');
    });
  });
});