/**
 * @fileoverview Portfolio-specific error classes for handling portfolio-related errors.
 * @module utils/PortfolioError
 */

const httpStatus = require('http-status');
const ApiError = require('./ApiError');

/**
 * Base class for portfolio-related errors
 */
class PortfolioError extends ApiError {
  constructor(statusCode, message, code = null, details = null) {
    super(statusCode, message, code);
    this.details = details;
    this.category = 'PORTFOLIO';
  }
}

/**
 * Error for file validation failures
 */
class FileValidationError extends PortfolioError {
  constructor(message, details = null) {
    super(httpStatus.BAD_REQUEST, message, 'FILE_VALIDATION_ERROR', details);
  }

  static invalidFileType(allowedTypes, receivedType) {
    return new FileValidationError(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      { allowedTypes, receivedType }
    );
  }

  static fileTooLarge(maxSize, actualSize) {
    return new FileValidationError(
      `File size exceeds limit. Maximum allowed: ${Math.round(maxSize / 1024 / 1024)}MB`,
      { maxSize, actualSize }
    );
  }

  static invalidMimeType(allowedMimeTypes, receivedMimeType) {
    return new FileValidationError(
      `Invalid MIME type: ${receivedMimeType}. Allowed: ${allowedMimeTypes.join(', ')}`,
      { allowedMimeTypes, receivedMimeType }
    );
  }

  static missingFile() {
    return new FileValidationError('No file provided for upload');
  }

  static corruptedFile(filename) {
    return new FileValidationError(
      `File appears to be corrupted: ${filename}`,
      { filename }
    );
  }
}

/**
 * Error for portfolio limit violations
 */
class PortfolioLimitError extends PortfolioError {
  constructor(message, details = null) {
    super(httpStatus.CONFLICT, message, 'PORTFOLIO_LIMIT_ERROR', details);
  }

  static maxImagesReached(maxImages, currentCount) {
    return new PortfolioLimitError(
      `Portfolio image limit reached. Maximum ${maxImages} images allowed`,
      { maxImages, currentCount }
    );
  }

  static quotaExceeded(quotaType, limit, current) {
    return new PortfolioLimitError(
      `${quotaType} quota exceeded. Limit: ${limit}, Current: ${current}`,
      { quotaType, limit, current }
    );
  }
}

/**
 * Error for storage-related failures
 */
class StorageError extends PortfolioError {
  constructor(message, details = null) {
    super(httpStatus.INTERNAL_SERVER_ERROR, message, 'STORAGE_ERROR', details);
  }

  static uploadFailed(reason, filename = null) {
    return new StorageError(
      'File upload failed. Please try again later.',
      { reason, filename, userMessage: 'Upload failed. Please try again.' }
    );
  }

  static deleteFailed(reason, filename = null) {
    return new StorageError(
      'File deletion failed',
      { reason, filename }
    );
  }

  static storageUnavailable(storageType) {
    return new StorageError(
      'Storage service temporarily unavailable. Please try again later.',
      { storageType, userMessage: 'Service temporarily unavailable. Please try again.' }
    );
  }

  static configurationError(configIssue) {
    return new StorageError(
      'Storage configuration error',
      { configIssue }
    );
  }
}

/**
 * Error for image processing failures
 */
class ImageProcessingError extends PortfolioError {
  constructor(message, details = null) {
    super(httpStatus.UNPROCESSABLE_ENTITY, message, 'IMAGE_PROCESSING_ERROR', details);
  }

  static processingFailed(reason, filename = null) {
    return new ImageProcessingError(
      'Image processing failed. The image may be corrupted or in an unsupported format.',
      { reason, filename, userMessage: 'Unable to process image. Please try a different image.' }
    );
  }

  static thumbnailGenerationFailed(reason, filename = null) {
    return new ImageProcessingError(
      'Failed to generate image thumbnails',
      { reason, filename, fallbackAvailable: true }
    );
  }

  static compressionFailed(reason, filename = null) {
    return new ImageProcessingError(
      'Image compression failed',
      { reason, filename, fallbackAvailable: true }
    );
  }

  static unsupportedFormat(format, filename = null) {
    return new ImageProcessingError(
      `Unsupported image format: ${format}`,
      { format, filename }
    );
  }
}

/**
 * Error for portfolio access and authorization
 */
class PortfolioAccessError extends PortfolioError {
  constructor(message, details = null) {
    super(httpStatus.FORBIDDEN, message, 'PORTFOLIO_ACCESS_ERROR', details);
  }

  static notProvider() {
    return new PortfolioAccessError(
      'Only service providers can manage portfolios',
      { requiredRole: 'provider' }
    );
  }

  static imageNotFound(imageId) {
    return new PortfolioAccessError(
      'Portfolio image not found or access denied',
      { imageId }
    );
  }

  static notOwner(imageId, providerId) {
    return new PortfolioAccessError(
      'You can only manage your own portfolio images',
      { imageId, providerId }
    );
  }
}

/**
 * Error for data validation failures
 */
class PortfolioDataError extends PortfolioError {
  constructor(message, details = null) {
    super(httpStatus.BAD_REQUEST, message, 'PORTFOLIO_DATA_ERROR', details);
  }

  static invalidDescription(maxLength) {
    return new PortfolioDataError(
      `Description must be less than ${maxLength} characters`,
      { maxLength }
    );
  }

  static invalidImageOrder(reason) {
    return new PortfolioDataError(
      `Invalid image order data: ${reason}`,
      { reason }
    );
  }

  static invalidImageId(imageId) {
    return new PortfolioDataError(
      'Invalid image ID format',
      { imageId }
    );
  }

  static missingRequiredField(fieldName) {
    return new PortfolioDataError(
      `Required field missing: ${fieldName}`,
      { fieldName }
    );
  }
}

module.exports = {
  PortfolioError,
  FileValidationError,
  PortfolioLimitError,
  StorageError,
  ImageProcessingError,
  PortfolioAccessError,
  PortfolioDataError
};