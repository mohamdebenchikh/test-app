const errorHandler = require('../../src/middlewares/errorHandler');
const ApiError = require('../../src/utils/ApiError');
const { isCelebrateError } = require('celebrate');

// Mock celebrate
jest.mock('celebrate', () => ({
  isCelebrateError: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn()
}));

describe('Error Handler Middleware', () => {
  let err, req, res, next;

  beforeEach(() => {
    err = new Error('Test error');
    req = {
      t: jest.fn((key) => key) // Mock translation function
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('Celebrate/Joi validation errors', () => {
    it('should handle celebrate errors and return 400 status', () => {
      const celebrateError = new Error('Validation failed');
      celebrateError.details = new Map([
        ['body', { message: 'Invalid email' }]
      ]);
      
      isCelebrateError.mockReturnValue(true);
      
      errorHandler(celebrateError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'errors.validationError',
        errors: ['Invalid email']
      });
    });
  });

  describe('Sequelize validation errors', () => {
    it('should handle Sequelize validation errors and return 400 status', () => {
      const sequelizeError = new Error('Validation error');
      sequelizeError.name = 'SequelizeValidationError';
      sequelizeError.errors = [{ message: 'Email is required' }];
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(sequelizeError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'errors.validationError',
        errors: ['Email is required']
      });
    });
  });

  describe('Sequelize unique constraint errors', () => {
    it('should handle unique constraint errors and return 409 status', () => {
      const uniqueError = new Error('Unique constraint error');
      uniqueError.name = 'SequelizeUniqueConstraintError';
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(uniqueError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'errors.resourceExists'
      });
    });
  });

  describe('ApiError handling', () => {
    it('should handle ApiError and return appropriate status code', () => {
      const apiError = new ApiError(404, 'User not found');
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(apiError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle ApiError with default status code 500 if not provided', () => {
      const apiError = new ApiError();
      apiError.message = 'Internal error';
      apiError.statusCode = undefined; // Simulate missing status code
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(apiError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal error'
      });
    });
  });

  describe('Unexpected errors', () => {
    it('should handle unexpected errors and return 500 status in production', () => {
      process.env.NODE_ENV = 'production';
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'errors.internalServerError'
      });
    });

    it('should handle unexpected errors and return 500 status with stack trace in development', () => {
      process.env.NODE_ENV = 'development';
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'errors.internalServerError',
        stack: err.stack
      });
    });
  });

  describe('Translation handling', () => {
    it('should fall back to original message if translation fails', () => {
      req.t = jest.fn(() => {
        throw new Error('Translation failed');
      });
      
      const apiError = new ApiError(400, 'Original message');
      
      isCelebrateError.mockReturnValue(false);
      
      errorHandler(apiError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Original message'
      });
    });
  });
});