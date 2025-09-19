const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Image processing utility for generating multiple image sizes
 * with aspect ratio preservation and web optimization
 */
class ImageProcessor {
  constructor() {
    this.sizes = {
      thumbnail: { width: 150, height: 150 },
      medium: { width: 400, height: 400 }
    };
    
    this.compressionOptions = {
      jpeg: { quality: 85, progressive: true },
      png: { compressionLevel: 8, progressive: true },
      webp: { quality: 85, effort: 4 }
    };
  }

  /**
   * Generate multiple image sizes from a source image
   * @param {Buffer|string} input - Image buffer or file path
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Object containing processed image buffers
   */
  async generateImageVariants(input, options = {}) {
    try {
      const image = sharp(input);
      const metadata = await image.metadata();
      
      // Validate image format
      if (!this.isValidImageFormat(metadata.format)) {
        throw new Error(`Unsupported image format: ${metadata.format}`);
      }

      const results = {
        original: null,
        thumbnail: null,
        medium: null,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: metadata.size
        }
      };

      // Generate optimized original
      results.original = await this.processImage(image.clone(), {
        format: metadata.format,
        optimize: true
      });

      // Generate thumbnail (150x150)
      results.thumbnail = await this.processImage(image.clone(), {
        width: this.sizes.thumbnail.width,
        height: this.sizes.thumbnail.height,
        format: metadata.format,
        fit: 'cover',
        optimize: true
      });

      // Generate medium size (400x400)
      results.medium = await this.processImage(image.clone(), {
        width: this.sizes.medium.width,
        height: this.sizes.medium.height,
        format: metadata.format,
        fit: 'inside',
        optimize: true
      });

      return results;
    } catch (error) {
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * Process a single image with specified options
   * @param {Sharp} image - Sharp image instance
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async processImage(image, options = {}) {
    let processor = image;

    // Resize if dimensions are specified
    if (options.width || options.height) {
      processor = processor.resize(options.width, options.height, {
        fit: options.fit || 'inside',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });
    }

    // Apply format-specific compression
    const format = options.format || 'jpeg';
    const compressionOpts = this.compressionOptions[format] || this.compressionOptions.jpeg;

    switch (format) {
      case 'jpeg':
      case 'jpg':
        processor = processor.jpeg(compressionOpts);
        break;
      case 'png':
        processor = processor.png(compressionOpts);
        break;
      case 'webp':
        processor = processor.webp(compressionOpts);
        break;
      default:
        processor = processor.jpeg(this.compressionOptions.jpeg);
    }

    return await processor.toBuffer();
  }

  /**
   * Generate thumbnail with aspect ratio preservation
   * @param {Buffer|string} input - Image buffer or file path
   * @param {Object} options - Thumbnail options
   * @returns {Promise<Buffer>} Thumbnail image buffer
   */
  async generateThumbnail(input, options = {}) {
    const width = options.width || this.sizes.thumbnail.width;
    const height = options.height || this.sizes.thumbnail.height;
    const fit = options.fit || 'cover';

    try {
      const image = sharp(input);
      const metadata = await image.metadata();

      return await this.processImage(image, {
        width,
        height,
        format: metadata.format,
        fit,
        optimize: true
      });
    } catch (error) {
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Generate medium size image with aspect ratio preservation
   * @param {Buffer|string} input - Image buffer or file path
   * @param {Object} options - Medium size options
   * @returns {Promise<Buffer>} Medium size image buffer
   */
  async generateMediumSize(input, options = {}) {
    const width = options.width || this.sizes.medium.width;
    const height = options.height || this.sizes.medium.height;
    const fit = options.fit || 'inside';

    try {
      const image = sharp(input);
      const metadata = await image.metadata();

      return await this.processImage(image, {
        width,
        height,
        format: metadata.format,
        fit,
        optimize: true
      });
    } catch (error) {
      throw new Error(`Medium size generation failed: ${error.message}`);
    }
  }

  /**
   * Optimize image for web without resizing
   * @param {Buffer|string} input - Image buffer or file path
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} Optimized image buffer
   */
  async optimizeForWeb(input, options = {}) {
    try {
      const image = sharp(input);
      const metadata = await image.metadata();

      return await this.processImage(image, {
        format: metadata.format,
        optimize: true,
        ...options
      });
    } catch (error) {
      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Get image metadata
   * @param {Buffer|string} input - Image buffer or file path
   * @returns {Promise<Object>} Image metadata
   */
  async getImageMetadata(input) {
    try {
      const image = sharp(input);
      const metadata = await image.metadata();
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };
    } catch (error) {
      throw new Error(`Failed to get image metadata: ${error.message}`);
    }
  }

  /**
   * Check if image format is valid/supported
   * @param {string} format - Image format
   * @returns {boolean} True if format is supported
   */
  isValidImageFormat(format) {
    const supportedFormats = ['jpeg', 'jpg', 'png', 'webp'];
    return supportedFormats.includes(format?.toLowerCase());
  }

  /**
   * Calculate aspect ratio
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {number} Aspect ratio
   */
  calculateAspectRatio(width, height) {
    return width / height;
  }

  /**
   * Calculate dimensions that maintain aspect ratio within bounds
   * @param {number} originalWidth - Original image width
   * @param {number} originalHeight - Original image height
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @returns {Object} Calculated dimensions
   */
  calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    const aspectRatio = this.calculateAspectRatio(originalWidth, originalHeight);
    
    let width = maxWidth;
    let height = maxHeight;

    if (width / height > aspectRatio) {
      width = height * aspectRatio;
    } else {
      height = width / aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }
}

module.exports = ImageProcessor;