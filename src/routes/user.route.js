const express = require('express');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { userValidation } = require('../validations');
const { userController } = require('../controllers');
const upload = require('../middlewares/upload');

const router = express.Router();

router
    .route('/profile')
    .get(authenticate, userController.getProfile)
    .patch(authenticate, validate(userValidation.updateProfile), userController.updateProfile)
    .delete(authenticate, userController.deleteAccount);

router
    .route('/profile/avatar')
    .post(authenticate, upload.single('avatar'), userController.uploadAvatar);

router
    .route('/profile/change-password')
    .post(authenticate, validate(userValidation.changePassword), userController.changePassword);

module.exports = router;
