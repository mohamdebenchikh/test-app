const request = require('supertest');
const app = require('../index');

describe('API Health Check', () => {
  it('should return status OK for the root endpoint', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.body.status).toBe('OK');
  });
});