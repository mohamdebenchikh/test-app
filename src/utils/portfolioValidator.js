/**
 * @fileoverview Comprehensive validation utilities for portfolio operations
 * @module utils/portfolioValidator
 */

const {
  FileValidationError,
  PortfolioLimitError,
  PortfolioDataError,
  ImageProcessingError
} = require('./PortfolioError');

/**
 * Portfolio validation utility class
 */
class PortfolioValidator {
  constructor(config) {
    this.config = config;
    this.allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    this.maxDescriptionLength = 1000;
  }

  /**
   * Validate uploaded file
   * @param {Object} file - File object with buffer, originalname, mimetype, size
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateFile(file, options = {}) {
    const errors = [];
    const warnings = [];

    // Check if file exists
    if (!file) {
      throw FileValidationError.missingFile();
    }

    // Validate file size
    if (file.size > this.config.limits.maxFileSize) {
      throw FileValidationError.fileTooLarge(this.config.limits.maxFileSize, file.size);
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw FileValidationError.invalidMimeType(this.allowedMimeTypes, file.mimetype);
    }

    // Validate file extension
    const fileExtension = this.getFileExtension(file.originalname);
    if (!this.config.limits.allowedTypes.includes(fileExtension)) {
      throw FileValidationError.invalidFileType(this.config.limits.allowedTypes, fileExtension);
    }

    // Check for potential security issues
    this.validateFilenameSecurity(file.originalname);

    // Validate file buffer
    if (!file.buffer || file.buffer.length === 0) {
      throw FileValidationError.corruptedFile(file.originalname);
    }

    // Check for minimum file size (avoid empty or corrupted files)
    if (file.size < 100) { // 100 bytes minimum
      throw FileValidationError.corruptedFile(file.originalname);
    }

    // Validate image header (basic check)
    this.validateImageHeader(file.buffer, file.mimetype);

    return {
      valid: true,
      errors,
      warnings,
      metadata: {
        size: file.size,
        type: file.mimetype,
        extension: fileExtension,
        originalName: file.originalname
      }
    };
  }

  /**
   * Validate portfolio limits
   * @param {number} currentCount - Current number of images in portfolio
   * @param {Object} options - Additional validation options
   */
  validatePortfolioLimits(currentCount, options = {}) {
    const { isUpdate = false } = options;

    // Check maximum images limit
    const effectiveLimit = isUpdate ? this.config.limits.maxImages : this.config.limits.maxImages - 1;
    if (currentCount > effectiveLimit) {
      throw PortfolioLimitError.maxImagesReached(this.config.limits.maxImages, currentCount);
    }

    return {
      valid: true,
      remainingSlots: this.config.limits.maxImages - currentCount,
      maxImages: this.config.limits.maxImages
    };
  }

  /**
   * Validate image description
   * @param {string} description - Image description
   * @returns {Object} Validation result
   */
  validateDescription(description) {
    if (description === null || description === undefined) {
      return { valid: true, description: null };
    }

    if (typeof description !=