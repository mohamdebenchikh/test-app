const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');

describe('Auth Register API', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should register a new user successfully', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'client'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('tokens');
    expect(response.body.user.email).toBe(userData.email);
    expect(response.body.user.name).toBe(userData.name);
  });

  it('should return 400 for invalid email format', async () => {
    const invalidData = {
      name: 'Test User',
      email: 'invalid-email',
      password: 'Password123!',
      role: 'client'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 when email is missing', async () => {
    const invalidData = {
      name: 'Test User',
      password: 'Password123!',
      role: 'client'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 when password is missing', async () => {
    const invalidData = {
      name: 'Test User',
      email: 'test@example.com',
      role: 'client'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 when name is missing', async () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'Password123!',
      role: 'client'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 when role is missing', async () => {
    const invalidData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should return 400 when role is invalid', async () => {
    const invalidData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: 'invalid-role'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});