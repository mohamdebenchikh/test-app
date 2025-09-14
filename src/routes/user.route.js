const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth');
const { userController } = require('../../controllers');

const router = express.Router();

router
  .route('/profile')
  .get(authenticate, userController.getUser)
  .patch(authenticate, userController.updateUser)
  .delete(authenticate, userController.deleteUser);

router.route('/profile/change-password').post(authenticate, userController.updateUserPassword);

router.route('/profile/services').post(authenticate, authorize(['provider']), userController.updateProviderServices);

module.exports = router;
