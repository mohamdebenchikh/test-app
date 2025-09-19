const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { portfolioImageUpload, portfolioAccess } = require('../middlewares/portfolioUpload');
const { userController, portfolioController } = require('../controllers');
const validate = require('../middlewares/validate');
const { userValidation, portfolioValidation } = require('../validations');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

const router = express.Router();

/**
 * Portfolio-specific error handler middleware
 */
const handlePortfolioErrors = (error, req, res, next) => {
  // Handle portfolio-specific errors
  if (error.message && error.message.includes('portfolio')) {
    // Portfolio limit errors
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: 'Portfolio Limit Exceeded',
        message: error.message
      });
    }
    
    // Portfolio file validation errors
    if (error.statusCode === 400 && error.message.includes('images are allowed')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid File Type',
        message: error.message
      });
    }
    
    // Portfolio file size errors
    if (error.statusCode === 413) {
      return res.status(413).json({
        success: false,
        error: 'File Too Large',
        message: error.message
      });
    }
  }
  
  // Pass other errors to default handler
  next(error);
};

router
  .route('/profile')
  .get(authenticate, userController.getUser)
  .patch(authenticate, userController.updateUser)
  .delete(authenticate, validate(userValidation.deleteUser), userController.deleteUser);

router.route('/profile/change-password').post(authenticate, validate(userValidation.changePassword), userController.changePassword);

router.route('/profile/avatar').patch(authenticate, upload.single('avatar'), userController.updateAvatar);

router.route('/profile/services').post(authenticate, authorize(['provider']), userController.updateProviderServices);

// Portfolio endpoints with proper authentication and validation
router
  .route('/profile/portfolio')
  .post(
    authenticate,
    authorize(['provider']),
    validate(portfolioValidation.uploadPortfolioImage),
    portfolioImageUpload,
    handlePortfolioErrors,
    portfolioController.uploadPortfolioImage
  )
  .get(
    authenticate,
    authorize(['provider']),
    validate(portfolioValidation.getPrivatePortfolio),
    portfolioController.getPrivatePortfolio
  );

router
  .route('/profile/portfolio/stats')
  .get(
    authenticate,
    authorize(['provider']),
    portfolioController.getPortfolioStats
  );

router
  .route('/profile/portfolio/order')
  .put(
    authenticate,
    authorize(['provider']),
    validate(portfolioValidation.updateImageOrder),
    portfolioController.updateImageOrder
  );

router
  .route('/profile/portfolio/:imageId')
  .put(
    authenticate,
    authorize(['provider']),
    validate(portfolioValidation.updateImageDescription),
    portfolioController.updateImageDescription
  )
  .delete(
    authenticate,
    authorize(['provider']),
    validate(portfolioValidation.deletePortfolioImage),
    portfolioController.deletePortfolioImage
  );

// Public profile endpoints
router.route('/providers/:id/profile').get(userController.getProviderProfile);
router.route('/clients/:id/profile').get(userController.getClientProfile);

// Public portfolio endpoint with validation
router
  .route('/:userId/portfolio')
  .get(
    validate(portfolioValidation.getPublicPortfolio),
    portfolioController.getPublicPortfolio
  );

// Apply portfolio error handler to all routes
router.use(handlePortfolioErrors);

module.exports = router;