const { 
  requireProvider, 
  validatePortfolioLimits,
  handlePortfolioUploadError 
} = require('../middlewares/portfolioUpload');
const { ProviderPortfolio } = require('../models');
const ApiError = require('../utils/ApiError');

// Mock the models
jest.mock('../models', () => ({
  ProviderPortfolio: {
    count: jest.fn()
  }
}));

describe('Portfolio Upload Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireProvider', () => {
    it('should allow providers to proceed', () => {
      req.user = { id: 'provider-123', role: 'provider' };

      requireProvider(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should reject unauthenticated users', () => {
      requireProvider(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required'
        })
      );
    });

    it('should reject non-provider users', () => {
      req.user = { id: 'client-123', role: 'client' };

      requireProvider(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Only service providers can manage portfolio images'
        })
      );
    });

    it('should reject admin users', () => {
      req.user = { id: 'admin-123', role: 'admin' };

      requireProvider(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Only service providers can manage portfolio images'
        })
      );
    });
  });

  describe('validatePortfolioLimits', () => {
    beforeEach(() => {
      req.user = { id: 'provider-123', role: 'provider' };
    });

    it('should allow upload when under limit', async () => {
      ProviderPortfolio.count.mockResolvedValue(5);

      await validatePortfolioLimits(req, res, next);

      expect(req.portfolioImageCount).toBe(5);
      expect(next).toHaveBeenCalledWith();
      expect(ProviderPortfolio.count).toHaveBeenCalledWith({
        where: { provider_id: 'provider-123' }
      });
    });

    it('should reject upload when at limit', async () => {
      // Mock config to ensure we know the limit
      const config = require('../config/config');
      const originalLimit = config.portfolio.limits.maxImages;
      config.portfolio.limits.maxImages = 5;
      
      ProviderPortfolio.count.mockResolvedValue(5);

      await validatePortfolioLimits(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const calledWith = next.mock.calls[0][0];
      
      expect(calledWith).toBeInstanceOf(Error);
      expect(calledWith.statusCode).toBe(409); // Use direct status code since httpStatus.CONFLICT is undefined
      expect(calledWith.message).toBe('Portfolio limit reached. Maximum 5 images allowed per provider');
      
      // Restore original limit
      config.portfolio.limits.maxImages = originalLimit;
    });

    it('should handle database errors', async () => {
      ProviderPortfolio.count.mockRejectedValue(new Error('Database error'));

      await validatePortfolioLimits(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Error validating portfolio limits'
        })
      );
    });
  });

  describe('handlePortfolioUploadError', () => {
    it('should handle LIMIT_FILE_SIZE multer error', () => {
      const multerError = new Error('File too large');
      multerError.name = 'MulterError';
      multerError.code = 'LIMIT_FILE_SIZE';

      handlePortfolioUploadError(multerError, req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'File too large. Maximum size is 5MB'
        })
      );
    });

    it('should handle LIMIT_FILE_COUNT multer error', () => {
      const multerError = new Error('Too many files');
      multerError.name = 'MulterError';
      multerError.code = 'LIMIT_FILE_COUNT';

      handlePortfolioUploadError(multerError, req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Too many files. Only one file allowed per upload'
        })
      );
    });

    it('should handle LIMIT_UNEXPECTED_FILE multer error', () => {
      const multerError = new Error('Unexpected field');
      multerError.name = 'MulterError';
      multerError.code = 'LIMIT_UNEXPECTED_FILE';

      handlePortfolioUploadError(multerError, req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Unexpected file field. Use "image" field name'
        })
      );
    });

    it('should handle generic multer errors', () => {
      const multerError = new Error('Generic multer error');
      multerError.name = 'MulterError';
      multerError.code = 'UNKNOWN_ERROR';

      handlePortfolioUploadError(multerError, req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Upload error: Generic multer error'
        })
      );
    });

    it('should pass through non-multer errors', () => {
      const regularError = new ApiError(500, 'Regular error');

      handlePortfolioUploadError(regularError, req, res, next);

      expect(next).toHaveBeenCalledWith(regularError);
    });

    it('should handle errors with code property but no name', () => {
      const errorWithCode = new Error('Error with code');
      errorWithCode.code = 'LIMIT_FILE_SIZE';

      handlePortfolioUploadError(errorWithCode, req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 413,
          message: 'File too large. Maximum size is 5MB'
        })
      );
    });
  });
});