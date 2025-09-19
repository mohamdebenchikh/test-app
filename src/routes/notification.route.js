const express = require('express');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { notificationController } = require('../controllers');

const router = express.Router();

router.use(authenticate);

router
  .route('/')
  .get(notificationController.getNotifications);

router
  .route('/:notificationId')
  .get(notificationController.getNotification)
  .patch(notificationController.markAsRead)
  .delete(notificationController.deleteNotification);

router
  .route('/mark-all-read')
  .post(notificationController.markAllAsRead);

module.exports = router;