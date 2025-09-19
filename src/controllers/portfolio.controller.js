/**
 * @fileoverview Portfolio controller for handling provider portfolio management.
 * @module controllers/portfolio
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const PortfolioService = require('../services/portfolio.service');

const portfolioService = new PortfolioService();

/**
 * Upload a new portfolio image
 * POST /api/users/profile/portfolio
 */
const uploadPortfolioImage = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No image file uploaded');
  }

  const providerId = req.user.id;
  const { description } = req.body;

  const result = await portfolioService.addPortfolioImage(providerId, req.file, description);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: result.message,
    data: result.data
  });
});

/**
 * Get provider's portfolio (public access)
 * GET /api/users/:userId/portfolio
 */
const getPublicPortfolio = catchAsync(async (req, res) => {
  const providerId = req.params.userId;
  const { limit, offset } = req.query;

  const options = {
    includePrivate: false,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined
  };

  const result = await portfolioService.getProviderPortfolio(providerId, options);

  res.json({
    success: true,
    data: result.data
  });
});

/**
 * Get own portfolio (private access)
 * GET /api/users/profile/portfolio
 */
const getPrivatePortfolio = catchAsync(async (req, res) => {
  const providerId = req.user.id;
  const { limit, offset } = req.query;

  const options = {
    includePrivate: true,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined
  };

  const result = await portfolioService.getProviderPortfolio(providerId, options);

  res.json({
    success: true,
    data: result.data
  });
});

/**
 * Update image order for drag-and-drop reordering
 * PUT /api/users/profile/portfolio/order
 */
const updateImageOrder = catchAsync(async (req, res) => {
  const providerId = req.user.id;
  const { imageOrders } = req.body;

  if (!imageOrders || !Array.isArray(imageOrders)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'imageOrders must be an array');
  }

  const result = await portfolioService.updateImageOrder(providerId, imageOrders);

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * Delete a portfolio image
 * DELETE /api/users/profile/portfolio/:imageId
 */
const deletePortfolioImage = catchAsync(async (req, res) => {
  const providerId = req.user.id;
  const { imageId } = req.params;

  if (!imageId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Image ID is required');
  }

  const result = await portfolioService.deletePortfolioImage(providerId, imageId);

  res.json({
    success: true,
    message: result.message
  });
});

/**
 * Update portfolio image description
 * PUT /api/users/profile/portfolio/:imageId
 */
const updateImageDescription = catchAsync(async (req, res) => {
  const providerId = req.user.id;
  const { imageId } = req.params;
  const { description } = req.body;

  if (!imageId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Image ID is required');
  }

  const result = await portfolioService.updateImageDescription(providerId, imageId, description);

  res.json({
    success: true,
    message: result.message,
    data: result.data
  });
});

/**
 * Get portfolio statistics
 * GET /api/users/profile/portfolio/stats
 */
const getPortfolioStats = catchAsync(async (req, res) => {
  const providerId = req.user.id;

  const result = await portfolioService.getPortfolioStats(providerId);

  res.json({
    success: true,
    data: result.data
  });
});

module.exports = {
  uploadPortfolioImage,
  getPublicPortfolio,
  getPrivatePortfolio,
  updateImageOrder,
  deletePortfolioImage,
  updateImageDescription,
  getPortfolioStats
};