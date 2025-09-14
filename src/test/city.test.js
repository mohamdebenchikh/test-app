const request = require('supertest');
const app = require('../../index');
const httpStatus = require('http-status');

describe('City routes', () => {
  describe('GET /api/cities', () => {
    it('should return a list of cities', async () => {
      const res = await request(app)
        .get('/api/cities')
        .expect(httpStatus.OK);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(5);
      expect(res.body[0].name).toBe('New York');
    });
  });
});
