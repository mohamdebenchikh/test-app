/**
 * @fileoverview Notification controller for handling notification management.
 * @module controllers/notification
 */

const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { notificationService } = require('../services');

const getNotifications = catchAsync(async (req, res) => {
  const options = {
    read: req.query.read,
    limit: req.query.limit,
    offset: req.query.page ? (req.query.page - 1) * req.query.limit : 0
  };
  
  const notifications = await notificationService.getNotificationsByUserId(req.user.sub, options);
  res.send(notifications);
});

const getNotification = catchAsync(async (req, res) => {
  const notification = await notificationService.getNotificationById(req.params.notificationId);
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  res.send(notification);
});

const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.notificationId);
  res.send(notification);
});

const markAllAsRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user.sub);
  res.status(httpStatus.NO_CONTENT).send();
});

const deleteNotification = catchAsync(async (req, res) => {
  await notificationService.deleteNotificationById(req.params.notificationId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  getNotifications,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};