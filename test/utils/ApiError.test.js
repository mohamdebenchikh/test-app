const ApiError = require('../../src/utils/ApiError');

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create an ApiError instance with correct properties', () => {
      const error = new ApiError(404, 'User not found', 'USER_NOT_FOUND');
      
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.status).toBe('fail');
    });

    it('should set status to "error" for 5xx status codes', () => {
      const error = new ApiError(500, 'Internal server error');
      
      expect(error.status).toBe('error');
    });

    it('should set status to "fail" for 4xx status codes', () => {
      const error = new ApiError(400, 'Bad request');
      
      expect(error.status).toBe('fail');
    });

    it('should set code to null if not provided', () => {
      const error = new ApiError(404, 'Not found');
      
      expect(error.code).toBeNull();
    });
  });

  describe('Static methods', () => {
    it('should create a bad request error (400)', () => {
      const error = ApiError.badRequest('Invalid input');
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.status).toBe('fail');
    });

    it('should create a bad request error with default message', () => {
      const error = ApiError.badRequest();
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.status).toBe('fail');
    });

    it('should create an unauthorized error (401)', () => {
      const error = ApiError.unauthorized('Access denied');
      
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Access denied');
      expect(error.status).toBe('fail');
    });

    it('should create an unauthorized error with default message', () => {
      const error = ApiError.unauthorized();
      
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
      expect(error.status).toBe('fail');
    });

    it('should create a not found error (404)', () => {
      const error = ApiError.notFound('Resource not found');
      
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.status).toBe('fail');
    });

    it('should create a not found error with default message', () => {
      const error = ApiError.notFound();
      
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.status).toBe('fail');
    });

    it('should create an internal server error (500)', () => {
      const error = ApiError.internal('Database connection failed');
      
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Database connection failed');
      expect(error.status).toBe('error');
    });

    it('should create an internal server error with default message', () => {
      const error = ApiError.internal();
      
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.status).toBe('error');
    });
  });
});