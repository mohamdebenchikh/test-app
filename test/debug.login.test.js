const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');
const { userService } = require('../src/services');
const { comparePassword } = require('../src/utils/password');

describe('Debug Auth Login', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should debug login process', async () => {
    // Register a user
    const registerData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'client'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registerData);
    
    // Verify registration was successful
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toHaveProperty('user');
    expect(registerResponse.body).toHaveProperty('tokens');

    // Get the user from database
    const user = await userService.getUserByEmail('test@example.com');
    expect(user).not.toBeNull();
    
    if (user) {
      const isMatch = await comparePassword('Password123!', user.password);
      expect(isMatch).toBe(true);
    }

    // Try to login
    const loginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send(loginData);
    
    // Verify login was successful
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('user');
    expect(loginResponse.body).toHaveProperty('tokens');
  });
});