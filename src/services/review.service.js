const { Review, User } = require('../models');
const { createNotification } = require('./notification.service');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');

/**
 * Create a review
 * @param {Object} reviewBody
 * @returns {Promise<Review>}
 */
const createReview = async (reviewBody) => {
  try {
    // Check if both users exist and are valid (client and provider)
    const client = await User.findByPk(reviewBody.client_id);
    const provider = await User.findByPk(reviewBody.provider_id);
    
    if (!client || !provider) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client or provider not found');
    }
    
    if (client.role !== 'client') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a client');
    }
    
    if (provider.role !== 'provider') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a provider');
    }
    
    // Create the review
    const review = await Review.create(reviewBody);
    
    // Create notification for the provider
    await createReviewNotification(review, client, provider);
    
    return review;
  } catch (error) {
    console.error('Error creating review:', error);
    throw error;
  }
};

/**
 * Get reviews by provider id
 * @param {string} providerId
 * @returns {Promise<Review[]>}
 */
const getReviewsByProviderId = async (providerId) => {
  return Review.findAll({
    where: { provider_id: providerId },
    include: [{
      model: User,
      as: 'client',
      attributes: ['id', 'name', 'avatar']
    }],
    order: [['createdAt', 'DESC']]
  });
};

/**
 * Get review by id
 * @param {string} reviewId
 * @returns {Promise<Review>}
 */
const getReviewById = async (reviewId) => {
  return Review.findByPk(reviewId);
};

/**
 * Update review by id
 * @param {string} reviewId
 * @param {Object} updateBody
 * @returns {Promise<Review>}
 */
const updateReviewById = async (reviewId, updateBody) => {
  const review = await getReviewById(reviewId);
  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }
  Object.assign(review, updateBody);
  await review.save();
  return review;
};

/**
 * Delete review by id
 * @param {string} reviewId
 * @returns {Promise<Review>}
 */
const deleteReviewById = async (reviewId) => {
  const review = await getReviewById(reviewId);
  if (!review) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Review not found');
  }
  await review.destroy();
  return review;
};

/**
 * Create notification for a new review
 * @param {Review} review
 * @param {User} client
 * @param {User} provider
 * @returns {Promise<void>}
 */
const createReviewNotification = async (review, client, provider) => {
  try {
    const notificationData = {
      user_id: provider.id,
      type: 'review',
      title: 'New Review Received',
      message: `${client.name} left you a ${review.stars}-star review`,
      data: {
        review_id: review.id,
        client_id: client.id,
        stars: review.stars
      },
      related_id: review.id,
      related_type: 'review'
    };

    await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating review notification:', error);
    // Don't throw error here as we don't want to fail the review creation if notification fails
  }
};

module.exports = {
  createReview,
  getReviewsByProviderId,
  getReviewById,
  updateReviewById,
  deleteReviewById
};