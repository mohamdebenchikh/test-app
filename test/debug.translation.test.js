const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');
const i18next = require('../src/config/i18n');

describe('Debug Translation', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should test translation', async () => {
    // Register a user
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

    // Try to login with wrong password
    const loginData = {
      email: 'test@example.com',
      password: 'WrongPassword'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData);
    
    // Assertions
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });
});