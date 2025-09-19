const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');

describe('Auth Register and Login Integration Test', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should register and login a user successfully', async () => {
    // Register a user
    const registerData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'client'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registerData)
      .expect(201);

    expect(registerResponse.body).toHaveProperty('user');
    expect(registerResponse.body).toHaveProperty('tokens');
    expect(registerResponse.body.user.email).toBe(registerData.email);

    // Login with the same user
    const loginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(200);

    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('tokens');
    expect(loginResponse.body.user.email).toBe(loginData.email);
  });
});