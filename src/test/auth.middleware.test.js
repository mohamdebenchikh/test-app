const request = require('supertest');
const app = require('../../index');
const { User, sequelize } = require('../models');
const { generateToken } = require('../utils/jwt');
const httpStatus = require('http-status');
const { authorize } = require('../middlewares/auth');

describe('Auth middleware', () => {
  let user;
  let token;

  beforeAll(async () => {
    user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'client',
    });

    const tokenExpires = require('moment')().add(1, 'days');
    token = generateToken(user.id, tokenExpires, 'access');
  });


  describe('authenticate', () => {
    it('should return 401 if no token is provided', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should return 401 if token is invalid', async () => {
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(httpStatus.UNAUTHORIZED);
    });

    it('should return 401 if user is not found', async () => {
        const tokenExpires = require('moment')().add(1, 'days');
        const nonExistentUserIdToken = generateToken(999, tokenExpires, 'access');
        await request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${nonExistentUserIdToken}`)
            .expect(httpStatus.UNAUTHORIZED);
    });

    it('should call next() if token is valid', async () => {
        await request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${token}`)
            .expect(httpStatus.OK);
    });
  });

  describe('authorize', () => {
    it('should return 403 if user does not have required role', () => {
        const req = { user: { role: 'client' } };
        const res = {};
        const next = jest.fn();
        authorize(['admin'])(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.FORBIDDEN);
    });

    it('should call next() if user has required role', () => {
        const req = { user: { role: 'admin' } };
        const res = {};
        const next = jest.fn();
        authorize(['admin'])(req, res, next);
        expect(next).toHaveBeenCalledWith();
    });
  });

  describe('optionalAuth', () => {
    it('should set req.user if token is valid', async () => {
      const { optionalAuth } = require('../middlewares/auth');
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {};
      const next = jest.fn();
      await optionalAuth(req, res, next);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user.id);
      expect(next).toHaveBeenCalledWith();
    });

    it('should not set req.user if token is invalid', async () => {
        const { optionalAuth } = require('../middlewares/auth');
        const req = { headers: { authorization: 'Bearer invalidtoken' } };
        const res = {};
        const next = jest.fn();
        await optionalAuth(req, res, next);
        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
    });

    it('should not set req.user if there is no token', async () => {
        const { optionalAuth } = require('../middlewares/auth');
        const req = { headers: {} };
        const res = {};
        const next = jest.fn();
        await optionalAuth(req, res, next);
        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
    });
  });
});
