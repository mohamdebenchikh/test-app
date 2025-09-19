const PortfolioService = require('../services/portfolio.service');
const { ProviderPortfolio, User } = require('../models');
const UploadService = require('../services/upload.service');
const ImageProcessor = require('../utils/imageProcessor');
const config = require('../config/config');

// Mock dependencies
jest.mock('../models');
jest.mock('../services/upload.service');
jest.mock('../utils/imageProcessor');
jest.mock('../config/config', () => ({
  portfolio: {
    limits: {
      maxImages: 10,
      maxFileSize: 5242880, // 5MB
      allowedTypes: ['jpeg', 'jpg', 'png', 'webp']
    }
  }
}));

describe('PortfolioService', () => {
  let portfolioService;
  let mockUploadService;
  let mockImageProcessor;

  const mockProvider = {
    id: 'provider-123',
    name: 'Test Provider',
    role: 'provider'
  };

  const mockClientUser = {
    id: 'client-123',
    name: 'Test Client',
    role: 'client'
  };

  const mockFile = {
    buffer: Buffer.from('fake-image-data'),
    originalname: 'test-image.jpg',
    mimetype: 'image/jpeg',
    size: 1024000 // 1MB
  };

  const mockImageVariants = {
    original: Buffer.from('original-image'),
    thumbnail: Buffer.from('thumbnail-image'),
    medium: Buffer.from('medium-image'),
    metadata: {
      width: 800,
      height: 600,
      format: 'jpeg',
      size: 1024000
    }
  };

  const mockUploadResult = {
    success: true,
    url: 'https://example.com/image.jpg',
    path: 'portfolio/image.jpg'
  };

  beforeEach(() => {
    portfolioService = new PortfolioService();
    
    // Setup mocks
    mockUploadService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn()
    };
    mockImageProcessor = {
      generateImageVariants: jest.fn()
    };

    portfolioService.uploadService = mockUploadService;
    portfolioService.imageProcessor = mockImageProcessor;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('addPortfolioImage', () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockProvider);
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(5);
      mockImageProcessor.generateImageVariants.mockResolvedValue(mockImageVariants);
      mockUploadService.uploadFile.mockResolvedValue(mockUploadResult);
      ProviderPortfolio.create.mockResolvedValue({
        id: 'portfolio-123',
        provider_id: 'provider-123',
        image_url: 'https://example.com/image.jpg',
        thumbnail_url: 'https://example.com/image_thumb.jpg',
        medium_url: 'https://example.com/image_medium.jpg',
        description: 'Test description',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      });
    });

    it('should successfully add a portfolio image', async () => {
      const result = await portfolioService.addPortfolioImage(
        'provider-123',
        mockFile,
        'Test description'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toBe('Portfolio image added successfully');

      // Verify provider validation
      expect(User.findByPk).toHaveBeenCalledWith('provider-123');

      // Verify portfolio count check
      expect(ProviderPortfolio.getPortfolioCount).toHaveBeenCalledWith('provider-123');

      // Verify image processing
      expect(mockImageProcessor.generateImageVariants).toHaveBeenCalledWith(mockFile.buffer);

      // Verify uploads (3 variants)
      expect(mockUploadService.uploadFile).toHaveBeenCalledTimes(3);

      // Verify database creation
      expect(ProviderPortfolio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_id: 'provider-123',
          description: 'Test description',
          file_size: 1024000,
          mime_type: 'image/jpeg',
          original_filename: 'test-image.jpg'
        })
      );
    });

    it('should throw error if provider not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        portfolioService.addPortfolioImage('invalid-id', mockFile)
      ).rejects.toThrow('Failed to add portfolio image: Provider not found');
    });

    it('should throw error if user is not a provider', async () => {
      User.findByPk.mockResolvedValue({ ...mockProvider, role: 'client' });

      await expect(
        portfolioService.addPortfolioImage('provider-123', mockFile)
      ).rejects.toThrow('Failed to add portfolio image: User is not a provider');
    });

    it('should throw error if file size exceeds limit', async () => {
      const largeFile = { ...mockFile, size: 10485760 }; // 10MB

      await expect(
        portfolioService.addPortfolioImage('provider-123', largeFile)
      ).rejects.toThrow('Failed to add portfolio image: File size exceeds limit');
    });

    it('should throw error if file type not allowed', async () => {
      const invalidFile = { ...mockFile, originalname: 'test.gif', mimetype: 'image/gif' };

      await expect(
        portfolioService.addPortfolioImage('provider-123', invalidFile)
      ).rejects.toThrow('Failed to add portfolio image: File type not allowed');
    });

    it('should throw error if portfolio limit reached', async () => {
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(10);

      await expect(
        portfolioService.addPortfolioImage('provider-123', mockFile)
      ).rejects.toThrow('Failed to add portfolio image: Portfolio image limit reached');
    });

    it('should handle image processing failure', async () => {
      mockImageProcessor.generateImageVariants.mockRejectedValue(new Error('Processing failed'));

      await expect(
        portfolioService.addPortfolioImage('provider-123', mockFile)
      ).rejects.toThrow('Failed to add portfolio image: Processing failed');
    });

    it('should handle upload failure', async () => {
      mockUploadService.uploadFile.mockRejectedValue(new Error('Upload failed'));

      await expect(
        portfolioService.addPortfolioImage('provider-123', mockFile)
      ).rejects.toThrow('Failed to add portfolio image: Upload failed');
    });
  });

  describe('getProviderPortfolio', () => {
    const mockPortfolioItems = [
      {
        id: 'portfolio-1',
        provider_id: 'provider-123',
        image_url: 'portfolio/image1.jpg',
        thumbnail_url: 'portfolio/image1_thumb.jpg',
        medium_url: 'portfolio/image1_medium.jpg',
        description: 'Image 1',
        display_order: 1,
        toJSON: () => ({
          id: 'portfolio-1',
          provider_id: 'provider-123',
          image_url: 'portfolio/image1.jpg',
          thumbnail_url: 'portfolio/image1_thumb.jpg',
          medium_url: 'portfolio/image1_medium.jpg',
          description: 'Image 1',
          display_order: 1
        })
      }
    ];

    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockProvider);
      ProviderPortfolio.getProviderPortfolio.mockResolvedValue(mockPortfolioItems);
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(1);
      mockUploadService.getFileUrl.mockImplementation(path => `https://example.com/${path}`);
    });

    it('should successfully get provider portfolio', async () => {
      const result = await portfolioService.getProviderPortfolio('provider-123');

      expect(result.success).toBe(true);
      expect(result.data.provider).toEqual({
        id: 'provider-123',
        name: 'Test Provider',
        role: 'provider'
      });
      expect(result.data.portfolio).toHaveLength(1);
      expect(result.data.totalCount).toBe(1);

      // Verify URLs were transformed
      expect(result.data.portfolio[0].image_url).toBe('https://example.com/portfolio/image1.jpg');
      expect(result.data.portfolio[0].thumbnail_url).toBe('https://example.com/portfolio/image1_thumb.jpg');
      expect(result.data.portfolio[0].medium_url).toBe('https://example.com/portfolio/image1_medium.jpg');
    });

    it('should throw error if provider not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        portfolioService.getProviderPortfolio('invalid-id')
      ).rejects.toThrow('Failed to get provider portfolio: Provider not found');
    });

    it('should handle options correctly', async () => {
      const options = { limit: 5, offset: 10, includePrivate: true };

      await portfolioService.getProviderPortfolio('provider-123', options);

      expect(ProviderPortfolio.getProviderPortfolio).toHaveBeenCalledWith('provider-123', options);
    });
  });

  describe('updateImageOrder', () => {
    const mockImageOrders = [
      { id: 'portfolio-1', display_order: 2 },
      { id: 'portfolio-2', display_order: 1 }
    ];

    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockProvider);
      ProviderPortfolio.updateDisplayOrder.mockResolvedValue(true);
    });

    it('should successfully update image order', async () => {
      const result = await portfolioService.updateImageOrder('provider-123', mockImageOrders);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Image order updated successfully');
      expect(ProviderPortfolio.updateDisplayOrder).toHaveBeenCalledWith('provider-123', mockImageOrders);
    });

    it('should throw error if provider not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        portfolioService.updateImageOrder('invalid-id', mockImageOrders)
      ).rejects.toThrow('Failed to update image order: Provider not found');
    });

    it('should throw error if user is not a provider', async () => {
      User.findByPk.mockResolvedValue({ ...mockProvider, role: 'client' });

      await expect(
        portfolioService.updateImageOrder('provider-123', mockImageOrders)
      ).rejects.toThrow('Failed to update image order: User is not a provider');
    });

    it('should throw error for invalid input format', async () => {
      await expect(
        portfolioService.updateImageOrder('provider-123', null)
      ).rejects.toThrow('Failed to update image order: Image orders must be a non-empty array');

      await expect(
        portfolioService.updateImageOrder('provider-123', [])
      ).rejects.toThrow('Failed to update image order: Image orders must be a non-empty array');
    });

    it('should throw error for invalid order data', async () => {
      const invalidOrders = [{ id: 'portfolio-1' }]; // missing display_order

      await expect(
        portfolioService.updateImageOrder('provider-123', invalidOrders)
      ).rejects.toThrow('Failed to update image order: Each order update must have id and display_order');
    });

    it('should throw error for negative display order', async () => {
      const invalidOrders = [{ id: 'portfolio-1', display_order: -1 }];

      await expect(
        portfolioService.updateImageOrder('provider-123', invalidOrders)
      ).rejects.toThrow('Failed to update image order: Display order must be non-negative');
    });
  });

  describe('deletePortfolioImage', () => {
    const mockPortfolioItem = {
      id: 'portfolio-123',
      provider_id: 'provider-123',
      image_url: 'portfolio/image.jpg',
      thumbnail_url: 'portfolio/image_thumb.jpg',
      medium_url: 'portfolio/image_medium.jpg',
      destroy: jest.fn()
    };

    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockProvider);
      ProviderPortfolio.findOne.mockResolvedValue(mockPortfolioItem);
      mockPortfolioItem.destroy.mockResolvedValue();
      mockUploadService.deleteFile.mockResolvedValue(true);
    });

    it('should successfully delete portfolio image', async () => {
      const result = await portfolioService.deletePortfolioImage('provider-123', 'portfolio-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Portfolio image deleted successfully');

      // Verify database deletion
      expect(mockPortfolioItem.destroy).toHaveBeenCalled();

      // Verify file cleanup (3 files)
      expect(mockUploadService.deleteFile).toHaveBeenCalledTimes(3);
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith('portfolio/image.jpg');
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith('portfolio/image_thumb.jpg');
      expect(mockUploadService.deleteFile).toHaveBeenCalledWith('portfolio/image_medium.jpg');
    });

    it('should throw error if provider not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        portfolioService.deletePortfolioImage('invalid-id', 'portfolio-123')
      ).rejects.toThrow('Failed to delete portfolio image: Provider not found');
    });

    it('should throw error if portfolio image not found', async () => {
      ProviderPortfolio.findOne.mockResolvedValue(null);

      await expect(
        portfolioService.deletePortfolioImage('provider-123', 'invalid-id')
      ).rejects.toThrow('Failed to delete portfolio image: Portfolio image not found or does not belong to provider');
    });

    it('should continue even if file cleanup fails', async () => {
      mockUploadService.deleteFile.mockRejectedValue(new Error('File not found'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await portfolioService.deletePortfolioImage('provider-123', 'portfolio-123');

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Some files could not be cleaned up:',
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateImageDescription', () => {
    it('should successfully update image description', async () => {
      jest.clearAllMocks();
      
      // Create a fresh mock provider for this test
      const testProvider = {
        id: 'provider-123',
        name: 'Test Provider',
        role: 'provider'
      };
      
      User.findByPk.mockResolvedValueOnce(testProvider);
      ProviderPortfolio.update.mockResolvedValueOnce([1]); // 1 affected row
      ProviderPortfolio.findByPk.mockResolvedValueOnce({
        id: 'portfolio-123',
        description: 'Updated description'
      });

      const result = await portfolioService.updateImageDescription(
        'provider-123',
        'portfolio-123',
        'Updated description'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Image description updated successfully');
      expect(result.data.description).toBe('Updated description');

      expect(ProviderPortfolio.update).toHaveBeenCalledWith(
        { description: 'Updated description' },
        {
          where: {
            id: 'portfolio-123',
            provider_id: 'provider-123'
          }
        }
      );
    });

    it('should throw error for description too long', async () => {
      jest.clearAllMocks();
      
      const testProvider = {
        id: 'provider-123',
        name: 'Test Provider',
        role: 'provider'
      };
      
      User.findByPk.mockResolvedValueOnce(testProvider);
      const longDescription = 'a'.repeat(1001);

      await expect(
        portfolioService.updateImageDescription('provider-123', 'portfolio-123', longDescription)
      ).rejects.toThrow('Failed to update image description: Description must be less than 1000 characters');
    });

    it('should throw error if portfolio image not found', async () => {
      jest.clearAllMocks();
      
      const testProvider = {
        id: 'provider-123',
        name: 'Test Provider',
        role: 'provider'
      };
      
      User.findByPk.mockResolvedValueOnce(testProvider);
      ProviderPortfolio.update.mockResolvedValueOnce([0]); // 0 affected rows

      await expect(
        portfolioService.updateImageDescription('provider-123', 'invalid-id', 'Description')
      ).rejects.toThrow('Failed to update image description: Portfolio image not found or does not belong to provider');
    });
  });

  describe('getPortfolioStats', () => {
    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockProvider);
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(7);
    });

    it('should successfully get portfolio stats', async () => {
      const result = await portfolioService.getPortfolioStats('provider-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        totalImages: 7,
        maxImages: 10,
        remainingSlots: 3,
        maxFileSize: 5242880,
        allowedTypes: ['jpeg', 'jpg', 'png', 'webp']
      });
    });

    it('should handle case when portfolio is full', async () => {
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(10);

      const result = await portfolioService.getPortfolioStats('provider-123');

      expect(result.data.remainingSlots).toBe(0);
    });

    it('should throw error if provider not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        portfolioService.getPortfolioStats('invalid-id')
      ).rejects.toThrow('Failed to get portfolio stats: Provider not found');
    });
  });

  describe('validateProvider', () => {
    it('should return provider if valid', async () => {
      User.findByPk.mockResolvedValue(mockProvider);

      const result = await portfolioService.validateProvider('provider-123');

      expect(result).toEqual(mockProvider);
    });

    it('should throw error if provider not found', async () => {
      User.findByPk.mockResolvedValue(null);

      await expect(
        portfolioService.validateProvider('invalid-id')
      ).rejects.toThrow('Provider not found');
    });

    it('should throw error if user is not a provider', async () => {
      User.findByPk.mockResolvedValue({ ...mockProvider, role: 'client' });

      await expect(
        portfolioService.validateProvider('provider-123')
      ).rejects.toThrow('User is not a provider');
    });
  });

  describe('validatePortfolioLimits', () => {
    beforeEach(() => {
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(5);
    });

    it('should pass validation for valid file', async () => {
      await expect(
        portfolioService.validatePortfolioLimits('provider-123', mockFile)
      ).resolves.not.toThrow();
    });

    it('should throw error for file size too large', async () => {
      const largeFile = { ...mockFile, size: 10485760 }; // 10MB

      await expect(
        portfolioService.validatePortfolioLimits('provider-123', largeFile)
      ).rejects.toThrow('File size exceeds limit');
    });

    it('should throw error for invalid file extension', async () => {
      const invalidFile = { ...mockFile, originalname: 'test.gif' };

      await expect(
        portfolioService.validatePortfolioLimits('provider-123', invalidFile)
      ).rejects.toThrow('File type not allowed');
    });

    it('should throw error for invalid MIME type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'image/gif' };

      await expect(
        portfolioService.validatePortfolioLimits('provider-123', invalidFile)
      ).rejects.toThrow('MIME type not allowed');
    });

    it('should throw error when portfolio limit reached', async () => {
      ProviderPortfolio.getPortfolioCount.mockResolvedValue(10);

      await expect(
        portfolioService.validatePortfolioLimits('provider-123', mockFile)
      ).rejects.toThrow('Portfolio image limit reached');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension correctly', () => {
      expect(portfolioService.getFileExtension('test.jpg')).toBe('jpg');
      expect(portfolioService.getFileExtension('image.PNG')).toBe('png');
      expect(portfolioService.getFileExtension('file.jpeg')).toBe('jpeg');
      expect(portfolioService.getFileExtension('document.pdf')).toBe('pdf');
    });

    it('should handle files without extension', () => {
      expect(portfolioService.getFileExtension('filename')).toBe('');
    });
  });
});