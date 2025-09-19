const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');
const { loginUserWithEmailAndPassword } = require('../src/services/auth.service');
const ApiError = require('../src/utils/ApiError');
const httpStatus = require('http-status').default;

describe('Debug Auth Service', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should test auth service directly', async () => {
    // Register a user first
    const registerData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'client'
    };

    await request(app)
      .post('/api/auth/register')
      .send(registerData)
      .expect(201);

    // Test the auth service directly
    try {
      await loginUserWithEmailAndPassword('test@example.com', 'WrongPassword');
      fail('Should have thrown an error');
    } catch (error) {
      expect(error instanceof ApiError).toBe(true);
      expect(error.statusCode).toBe(httpStatus.UNAUTHORIZED);
      expect(error.message).toBe('errors.incorrectEmailOrPassword');
    }
  });
});