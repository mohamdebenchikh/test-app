const request = require('supertest');
const app = require('../../index');
const httpStatus = require('http-status');

describe('Service routes', () => {
  describe('GET /api/services', () => {
    it('should return a list of services', async () => {
      const res = await request(app)
        .get('/api/services')
        .expect(httpStatus.OK);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBe('Plumbing');
    });
  });
});
