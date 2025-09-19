const request = require('supertest');
const app = require('../index');
const { sequelize } = require('../src/models');
const { userService } = require('../src/services');

describe('Auth Login API - Simple Test', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  it('should return 400 for missing email and password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});