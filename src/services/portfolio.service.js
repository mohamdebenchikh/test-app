const { ProviderPortfolio, User } = require('../models');
const UploadService = require('./upload.service');
const ImageProcessor = require('../utils/imageProcessor');
const config = require('../config/config');
const path = require('path');
const crypto = require('crypto');

/**
 * Portfolio service for managing provider portfolio images
 * Handles file upload, processing, and database operations
 */
class PortfolioService {
  constructor() {
    this.uploadService = new UploadService();
    this.imageProcessor = new ImageProcessor();
    this.config = config.portfolio;
  }

  /**
   * Add a new portfolio image for a provider
   * @param {string} providerId - The provider's user ID
   * @param {Object} file - File object with buffer, originalname, mimetype
   * @param {string} description - Optional image description
   * @returns {Promise<Object>} Created portfolio entry
   */
  async addPortfolioImage(providerId, file, description = null) {
    try {
      // Validate provider exists and has correct role
      await this.validateProvider(providerId);

      // Check portfolio limits
      await this.validatePortfolioLimits(providerId, file);

      // Process image to generate variants
      const imageVariants = await this.imageProcessor.generateImageVariants(file.buffer);

      // Generate unique filenames for each variant
      const fileExtension = this.getFileExtension(file.originalname);
      const uniqueId = crypto.randomUUID();
      const baseFilename = `${providerId}_${uniqueId}`;
      
      const filenames = {
        original: `${baseFilename}.${fileExtension}`,
        thumbnail: `${baseFilename}_thumb.${fileExtension}`,
        medium: `${baseFilename}_medium.${fileExtension}`
      };

      // Upload all image variants
      const uploadResults = await this.uploadImageVariants(imageVariants, filenames);

      // Create database entry
      const portfolioData = {
        provider_id: providerId,
        image_url: uploadResults.original.url,
        thumbnail_url: uploadResults.thumbnail.url,
        medium_url: uploadResults.medium.url,
        description: description,
        file_size: file.size,
        mime_type: file.mimetype,
        original_filename: file.originalname
      };

      const portfolioEntry = await ProviderPortfolio.create(portfolioData);

      return {
        success: true,
        data: portfolioEntry,
        message: 'Portfolio image added successfully'
      };

    } catch (error) {
      throw new Error(`Failed to add portfolio image: ${error.message}`);
    }
  }

  /**
   * Get provider portfolio with privacy controls
   * @param {string} providerId - The provider's user ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Portfolio data
   */
  async getProviderPortfolio(providerId, options = {}) {
    try {
      const { includePrivate = false, limit, offset } = options;

      // Validate provider exists
      const provider = await User.findByPk(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Get portfolio items
      const portfolioItems = await ProviderPortfolio.getProviderPortfolio(providerId, {
        limit,
        offset,
        includePrivate
      });

      // Transform URLs to include full paths if needed
      const transformedItems = await Promise.all(
        portfolioItems.map(async (item) => {
          const itemData = item.toJSON();
          
          // Generate full URLs for each image variant
          itemData.image_url = await this.uploadService.getFileUrl(itemData.image_url);
          if (itemData.thumbnail_url) {
            itemData.thumbnail_url = await this.uploadService.getFileUrl(itemData.thumbnail_url);
          }
          if (itemData.medium_url) {
            itemData.medium_url = await this.uploadService.getFileUrl(itemData.medium_url);
          }

          return itemData;
        })
      );

      return {
        success: true,
        data: {
          provider: {
            id: provider.id,
            name: provider.name,
            role: provider.role
          },
          portfolio: transformedItems,
          totalCount: await ProviderPortfolio.getPortfolioCount(providerId)
        }
      };

    } catch (error) {
      throw new Error(`Failed to get provider portfolio: ${error.message}`);
    }
  }

  /**
   * Update image order for drag-and-drop reordering
   * @param {string} providerId - The provider's user ID
   * @param {Array} imageOrders - Array of {id, display_order} objects
   * @returns {Promise<Object>} Success status
   */
  async updateImageOrder(providerId, imageOrders) {
    try {
      // Validate provider exists and has correct role
      await this.validateProvider(providerId);

      // Validate input format
      if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
        throw new Error('Image orders must be a non-empty array');
      }

      // Validate each order update
      for (const order of imageOrders) {
        if (!order.id || typeof order.display_order !== 'number') {
          throw new Error('Each order update must have id and display_order');
        }
        if (order.display_order < 0) {
          throw new Error('Display order must be non-negative');
        }
      }

      // Update display orders using model method
      await ProviderPortfolio.updateDisplayOrder(providerId, imageOrders);

      return {
        success: true,
        message: 'Image order updated successfully'
      };

    } catch (error) {
      throw new Error(`Failed to update image order: ${error.message}`);
    }
  }

  /**
   * Delete a portfolio image with storage cleanup
   * @param {string} providerId - The provider's user ID
   * @param {string} imageId - The portfolio image ID
   * @returns {Promise<Object>} Success status
   */
  async deletePortfolioImage(providerId, imageId) {
    try {
      // Validate provider exists and has correct role
      await this.validateProvider(providerId);

      // Find the portfolio item
      const portfolioItem = await ProviderPortfolio.findOne({
        where: {
          id: imageId,
          provider_id: providerId
        }
      });

      if (!portfolioItem) {
        throw new Error('Portfolio image not found or does not belong to provider');
      }

      // Extract file paths for cleanup
      const filePaths = [
        portfolioItem.image_url,
        portfolioItem.thumbnail_url,
        portfolioItem.medium_url
      ].filter(Boolean);

      // Delete from database first
      await portfolioItem.destroy();

      // Clean up storage files
      const cleanupResults = await Promise.allSettled(
        filePaths.map(filePath => this.uploadService.deleteFile(filePath))
      );

      // Log any cleanup failures but don't fail the operation
      const failedCleanups = cleanupResults.filter(result => result.status === 'rejected');
      if (failedCleanups.length > 0) {
        console.warn('Some files could not be cleaned up:', failedCleanups.map(f => f.reason));
      }

      return {
        success: true,
        message: 'Portfolio image deleted successfully'
      };

    } catch (error) {
      throw new Error(`Failed to delete portfolio image: ${error.message}`);
    }
  }

  /**
   * Update portfolio image description
   * @param {string} providerId - The provider's user ID
   * @param {string} imageId - The portfolio image ID
   * @param {string} description - New description
   * @returns {Promise<Object>} Updated portfolio entry
   */
  async updateImageDescription(providerId, imageId, description) {
    try {
      // Validate provider exists and has correct role
      await this.validateProvider(providerId);

      // Validate description length
      if (description && description.length > 1000) {
        throw new Error('Description must be less than 1000 characters');
      }

      // Find and update the portfolio item
      const [affectedRows] = await ProviderPortfolio.update(
        { description: description },
        {
          where: {
            id: imageId,
            provider_id: providerId
          }
        }
      );

      if (affectedRows === 0) {
        throw new Error('Portfolio image not found or does not belong to provider');
      }

      // Return updated item
      const updatedItem = await ProviderPortfolio.findByPk(imageId);

      return {
        success: true,
        data: updatedItem,
        message: 'Image description updated successfully'
      };

    } catch (error) {
      throw new Error(`Failed to update image description: ${error.message}`);
    }
  }

  /**
   * Validate that user exists and is a provider
   * @param {string} providerId - The provider's user ID
   * @returns {Promise<Object>} Provider user object
   */
  async validateProvider(providerId) {
    const provider = await User.findByPk(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    if (provider.role !== 'provider') {
      throw new Error('User is not a provider');
    }
    return provider;
  }

  /**
   * Validate portfolio limits before upload
   * @param {string} providerId - The provider's user ID
   * @param {Object} file - File object
   * @returns {Promise<void>}
   */
  async validatePortfolioLimits(providerId, file) {
    // Check file size limit
    if (file.size > this.config.limits.maxFileSize) {
      throw new Error(`File size exceeds limit of ${this.config.limits.maxFileSize} bytes`);
    }

    // Check file type
    const fileExtension = this.getFileExtension(file.originalname).toLowerCase();
    if (!this.config.limits.allowedTypes.includes(fileExtension)) {
      throw new Error(`File type not allowed. Allowed types: ${this.config.limits.allowedTypes.join(', ')}`);
    }

    // Check MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`MIME type not allowed: ${file.mimetype}`);
    }

    // Check portfolio image count limit
    const currentCount = await ProviderPortfolio.getPortfolioCount(providerId);
    if (currentCount >= this.config.limits.maxImages) {
      throw new Error(`Portfolio image limit reached. Maximum ${this.config.limits.maxImages} images allowed`);
    }
  }

  /**
   * Upload all image variants to storage
   * @param {Object} imageVariants - Object containing original, thumbnail, medium buffers
   * @param {Object} filenames - Object containing filenames for each variant
   * @returns {Promise<Object>} Upload results for each variant
   */
  async uploadImageVariants(imageVariants, filenames) {
    const uploadPromises = [];

    // Upload original
    uploadPromises.push(
      this.uploadService.uploadFile(
        { buffer: imageVariants.original, originalname: filenames.original },
        { filename: filenames.original }
      ).then(result => ({ variant: 'original', ...result }))
    );

    // Upload thumbnail
    uploadPromises.push(
      this.uploadService.uploadFile(
        { buffer: imageVariants.thumbnail, originalname: filenames.thumbnail },
        { filename: filenames.thumbnail }
      ).then(result => ({ variant: 'thumbnail', ...result }))
    );

    // Upload medium
    uploadPromises.push(
      this.uploadService.uploadFile(
        { buffer: imageVariants.medium, originalname: filenames.medium },
        { filename: filenames.medium }
      ).then(result => ({ variant: 'medium', ...result }))
    );

    const results = await Promise.all(uploadPromises);

    // Transform results into object keyed by variant
    return results.reduce((acc, result) => {
      acc[result.variant] = result;
      return acc;
    }, {});
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Original filename
   * @returns {string} File extension without dot
   */
  getFileExtension(filename) {
    return path.extname(filename).slice(1).toLowerCase();
  }

  /**
   * Get portfolio statistics for a provider
   * @param {string} providerId - The provider's user ID
   * @returns {Promise<Object>} Portfolio statistics
   */
  async getPortfolioStats(providerId) {
    try {
      await this.validateProvider(providerId);

      const totalImages = await ProviderPortfolio.getPortfolioCount(providerId);
      const remainingSlots = this.config.limits.maxImages - totalImages;

      return {
        success: true,
        data: {
          totalImages,
          maxImages: this.config.limits.maxImages,
          remainingSlots: Math.max(0, remainingSlots),
          maxFileSize: this.config.limits.maxFileSize,
          allowedTypes: this.config.limits.allowedTypes
        }
      };

    } catch (error) {
      throw new Error(`Failed to get portfolio stats: ${error.message}`);
    }
  }
}

module.exports = PortfolioService;