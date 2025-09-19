const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');
const { userService } = require('../src/services');

describe('Auth Login API', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should login successfully with valid credentials', async () => {
    // First register a user
    const registerData = {
      name: 'Test User 1',
      email: 'test1@example.com',
      password: 'Password123!',
      role: 'client'
    };

    await request(app)
      .post('/api/auth/register')
      .send(registerData)
      .expect(201);

    // Then try to login
    const loginData = {
      email: 'test1@example.com',
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(200);

    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('tokens');
    expect(response.body.user.email).toBe(loginData.email);
  });

  it('should return 401 for invalid password', async () => {
    // First register a user
    const registerData = {
      name: 'Test User 2',
      email: 'test2@example.com',
      password: 'Password123!',
      role: 'client'
    };

    await request(app)
      .post('/api/auth/register')
      .send(registerData)
      .expect(201);

    // Then try to login with wrong password
    const loginData = {
      email: 'test2@example.com',
      password: 'WrongPassword'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 401 for non-existent user', async () => {
    const loginData = {
      email: 'nonexistent@example.com',
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 for missing email', async () => {
    const loginData = {
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 for missing password', async () => {
    const loginData = {
      email: 'test3@example.com'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});