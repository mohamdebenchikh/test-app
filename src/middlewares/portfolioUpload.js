const multer = require('multer');
const path = require('path');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { ProviderPortfolio } = require('../models');

/**
 * Portfolio-specific upload middleware with configurable validation
 */

// Memory storage for portfolio uploads (files will be processed by upload service)
const storage = multer.memoryStorage();

/**
 * File filter for portfolio images with configurable types
 * @param {Object} req - Express request object
 * @param {Object} file - Multer file object
 * @param {Function} cb - Callback function
 */
const portfolioFileFilter = (req, file, cb) => {
  const allowedTypes = config.portfolio.limits.allowedTypes;
  const allowedMimeTypes = allowedTypes.map(type => {
    switch (type.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return null;
    }
  }).filter(Boolean);

  const allowedExtensions = allowedTypes.map(type => {
    const lowerType = type.toLowerCase();
    // Handle jpeg/jpg equivalence
    if (lowerType === 'jpeg') {
      return ['.jpeg', '.jpg'];
    }
    return `.${lowerType}`;
  }).flat();
  
  const mimetype = allowedMimeTypes.includes(file.mimetype);
  const extname = allowedExtensions.includes(path.extname(file.originalname).toLowerCase());



  if (mimetype && extname) {
    return cb(null, true);
  }

  const allowedTypesStr = allowedTypes.join(', ').toUpperCase();
  cb(new ApiError(400, `Only ${allowedTypesStr} images are allowed`));
};

/**
 * Create multer upload instance for portfolio images
 */
const portfolioUpload = multer({
  storage,
  fileFilter: portfolioFileFilter,
  limits: {
    fileSize: config.portfolio.limits.maxFileSize,
    files: 1, // Single file upload
  },
});

/**
 * Middleware to check if user is a provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const requireProvider = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (req.user.role !== 'provider') {
    return next(new ApiError(403, 'Only service providers can manage portfolio images'));
  }

  next();
};

/**
 * Middleware to validate portfolio image count limits
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validatePortfolioLimits = async (req, res, next) => {
  try {
    const providerId = req.user.id;
    const maxImages = config.portfolio.limits.maxImages;

    // Count existing portfolio images for this provider
    const existingCount = await ProviderPortfolio.count({
      where: { provider_id: providerId }
    });

    if (existingCount >= maxImages) {
      return next(new ApiError(
        409, // HTTP 409 Conflict
        `Portfolio limit reached. Maximum ${maxImages} images allowed per provider`
      ));
    }

    // Add current count to request for use in controller
    req.portfolioImageCount = existingCount;
    next();
  } catch (error) {
    next(new ApiError(500, 'Error validating portfolio limits'));
  }
};

/**
 * Enhanced error handler for portfolio upload errors
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const handlePortfolioUploadError = (error, req, res, next) => {
  // Check if it's a MulterError by checking the constructor name or code property
  if (error.name === 'MulterError' || error.code) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        const maxSizeMB = Math.round(config.portfolio.limits.maxFileSize / (1024 * 1024));
        return next(new ApiError(
          413, // HTTP 413 Payload Too Large
          `File too large. Maximum size is ${maxSizeMB}MB`
        ));
      case 'LIMIT_FILE_COUNT':
        return next(new ApiError(
          400, // HTTP 400 Bad Request
          'Too many files. Only one file allowed per upload'
        ));
      case 'LIMIT_UNEXPECTED_FILE':
        return next(new ApiError(
          400, // HTTP 400 Bad Request
          'Unexpected file field. Use "image" field name'
        ));
      default:
        return next(new ApiError(400, `Upload error: ${error.message}`));
    }
  }
  next(error);
};

/**
 * Combined middleware for portfolio image upload
 * Includes provider authentication, file upload, and validation
 */
const portfolioImageUpload = [
  requireProvider,
  validatePortfolioLimits,
  portfolioUpload.single('image'),
  handlePortfolioUploadError
];

/**
 * Middleware for portfolio management endpoints (non-upload)
 * Only requires provider authentication
 */
const portfolioAccess = [
  requireProvider
];

module.exports = {
  portfolioImageUpload,
  portfolioAccess,
  requireProvider,
  validatePortfolioLimits,
  handlePortfolioUploadError
};