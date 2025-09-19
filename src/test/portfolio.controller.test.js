const httpStatus = require('http-status');
const { portfolioController } = require('../controllers');
const PortfolioService = require('../services/portfolio.service');
const ApiError = require('../utils/ApiError');

// Mock the portfolio service
jest.mock('../services/portfolio.service');

describe('Portfolio Controller', () => {
  let req, res, next;
  let mockPortfolioService;

  beforeEach(() => {
    req = {
      user: { id: 'provider-id', role: 'provider' },
      params: {},
      query: {},
      body: {},
      file: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    next = jest.fn();

    // Create a mock instance
    mockPortfolioService = {
      addPortfolioImage: jest.fn(),
      getProviderPortfolio: jest.fn(),
      updateImageOrder: jest.fn(),
      deletePortfolioImage: jest.fn(),
      updateImageDescription: jest.fn(),
      getPortfolioStats: jest.fn()
    };

    // Mock the constructor to return our mock instance
    PortfolioService.mockImplementation(() => mockPortfolioService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadPortfolioImage', () => {
    it('should upload portfolio image successfully', async () => {
      const mockFile = {
        buffer: Buffer.from('fake image data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };
      const mockResult = {
        success: true,
        message: 'Portfolio image added successfully',
        data: { id: 'image-id', description: 'Test image' }
      };

      req.file = mockFile;
      req.body.description = 'Test image';
      mockPortfolioService.addPortfolioImage.mockResolvedValue(mockResult);

      await portfolioController.uploadPortfolioImage(req, res, next);

      expect(mockPortfolioService.addPortfolioImage).toHaveBeenCalledWith(
        'provider-id',
        mockFile,
        'Test image'
      );
      expect(res.status).toHaveBeenCalledWith(httpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: mockResult.message,
        data: mockResult.data
      });
    });

    it('should return error when no file uploaded', async () => {
      req.file = null;

      await portfolioController.uploadPortfolioImage(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          message: 'No image file uploaded'
        })
      );
    });
  });

  describe('getPublicPortfolio', () => {
    it('should get public portfolio successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          provider: { id: 'provider-id', name: 'Test Provider' },
          portfolio: [{ id: 'image-id', image_url: 'http://example.com/image.jpg' }]
        }
      };

      req.params.userId = 'provider-id';
      req.query = { limit: '10', offset: '0' };
      mockPortfolioService.getProviderPortfolio.mockResolvedValue(mockResult);

      await portfolioController.getPublicPortfolio(req, res, next);

      expect(mockPortfolioService.getProviderPortfolio).toHaveBeenCalledWith(
        'provider-id',
        { includePrivate: false, limit: 10, offset: 0 }
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data
      });
    });
  });

  describe('getPrivatePortfolio', () => {
    it('should get private portfolio successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          provider: { id: 'provider-id', name: 'Test Provider' },
          portfolio: [{ id: 'image-id', image_url: 'http://example.com/image.jpg' }]
        }
      };

      req.query = { limit: '5', offset: '10' };
      mockPortfolioService.getProviderPortfolio.mockResolvedValue(mockResult);

      await portfolioController.getPrivatePortfolio(req, res, next);

      expect(mockPortfolioService.getProviderPortfolio).toHaveBeenCalledWith(
        'provider-id',
        { includePrivate: true, limit: 5, offset: 10 }
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data
      });
    });
  });

  describe('updateImageOrder', () => {
    it('should update image order successfully', async () => {
      const imageOrders = [
        { id: 'image-1', display_order: 0 },
        { id: 'image-2', display_order: 1 }
      ];
      const mockResult = {
        success: true,
        message: 'Image order updated successfully'
      };

      req.body.imageOrders = imageOrders;
      mockPortfolioService.updateImageOrder.mockResolvedValue(mockResult);

      await portfolioController.updateImageOrder(req, res, next);

      expect(mockPortfolioService.updateImageOrder).toHaveBeenCalledWith(
        'provider-id',
        imageOrders
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: mockResult.message
      });
    });

    it('should return error when imageOrders is not an array', async () => {
      req.body.imageOrders = 'invalid';

      await portfolioController.updateImageOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          message: 'imageOrders must be an array'
        })
      );
    });
  });

  describe('deletePortfolioImage', () => {
    it('should delete portfolio image successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Portfolio image deleted successfully'
      };

      req.params.imageId = 'image-id';
      mockPortfolioService.deletePortfolioImage.mockResolvedValue(mockResult);

      await portfolioController.deletePortfolioImage(req, res, next);

      expect(mockPortfolioService.deletePortfolioImage).toHaveBeenCalledWith(
        'provider-id',
        'image-id'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: mockResult.message
      });
    });

    it('should return error when imageId is missing', async () => {
      req.params.imageId = '';

      await portfolioController.deletePortfolioImage(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          message: 'Image ID is required'
        })
      );
    });
  });

  describe('updateImageDescription', () => {
    it('should update image description successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Image description updated successfully',
        data: { id: 'image-id', description: 'Updated description' }
      };

      req.params.imageId = 'image-id';
      req.body.description = 'Updated description';
      mockPortfolioService.updateImageDescription.mockResolvedValue(mockResult);

      await portfolioController.updateImageDescription(req, res, next);

      expect(mockPortfolioService.updateImageDescription).toHaveBeenCalledWith(
        'provider-id',
        'image-id',
        'Updated description'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: mockResult.message,
        data: mockResult.data
      });
    });

    it('should return error when imageId is missing', async () => {
      req.params.imageId = '';

      await portfolioController.updateImageDescription(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: httpStatus.BAD_REQUEST,
          message: 'Image ID is required'
        })
      );
    });
  });

  describe('getPortfolioStats', () => {
    it('should get portfolio statistics successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          totalImages: 5,
          maxImages: 10,
          remainingSlots: 5,
          maxFileSize: 5242880,
          allowedTypes: ['jpeg', 'jpg', 'png', 'webp']
        }
      };

      mockPortfolioService.getPortfolioStats.mockResolvedValue(mockResult);

      await portfolioController.getPortfolioStats(req, res, next);

      expect(mockPortfolioService.getPortfolioStats).toHaveBeenCalledWith('provider-id');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.data
      });
    });
  });
});