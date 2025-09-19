const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createReview, updateReview } = require('../validations/review.validation');
const { 
  createReviewHandler, 
  getProviderReviews, 
  getReview, 
  updateReview: updateReviewHandler, 
  deleteReview 
} = require('../controllers/review.controller');

const router = express.Router();

router.route('/')
  .post(authenticate, authorize(['client']), validate(createReview), createReviewHandler);

router.route('/provider/:providerId')
  .get(getProviderReviews);

router.route('/:reviewId')
  .get(getReview)
  .patch(authenticate, validate(updateReview), updateReviewHandler)
  .delete(authenticate, deleteReview);

module.exports = router;