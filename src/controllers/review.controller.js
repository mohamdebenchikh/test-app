const { createReview, getReviewsByProviderId, getReviewById, updateReviewById, deleteReviewById } = require('../services/review.service');
const catchAsync = require('../utils/catchAsync');

/**
 * Create a new review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createReviewHandler = catchAsync(async (req, res) => {
  const reviewBody = {
    ...req.body,
    client_id: req.user.sub // Get client ID from authenticated user (sub field in JWT)
  };
  
  const review = await createReview(reviewBody);
  res.status(201).send(review);
});

/**
 * Get reviews for a provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProviderReviews = catchAsync(async (req, res) => {
  const reviews = await getReviewsByProviderId(req.params.providerId);
  res.send(reviews);
});

/**
 * Get a specific review by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getReview = catchAsync(async (req, res) => {
  const review = await getReviewById(req.params.reviewId);
  res.send(review);
});

/**
 * Update a review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateReview = catchAsync(async (req, res) => {
  const review = await updateReviewById(req.params.reviewId, req.body);
  res.send(review);
});

/**
 * Delete a review
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteReview = catchAsync(async (req, res) => {
  await deleteReviewById(req.params.reviewId);
  res.status(204).send();
});

module.exports = {
  createReviewHandler,
  getProviderReviews,
  getReview,
  updateReview,
  deleteReview
};