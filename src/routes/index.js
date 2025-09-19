/**
 * @fileoverview Main router for the application.
 * @module routes
 */

const express = require('express');
const authRouter = require('./auth.route');
const userRouter = require('./user.route');
const cityRoute = require('./city.route');
const serviceRoute = require('./service.route');
const serviceRequestRoute = require('./serviceRequest.route');
const notificationRoute = require('./notification.route');
const reviewRoute = require('./review.route');
const providerRoute = require('./provider.route');
const clientRoute = require('./client.route');
const reportRoute = require('./report.route');
const blockRoute = require('./block.route');
const chatRoute = require('./chat.route');
const offerRoute = require('./offer.route');
const presenceRoute = require('./presence.route');
const maintenanceRoute = require('./maintenance.route');
const { trackActivity } = require('../middlewares/activityTracker');

const router = express.Router();

// Add activity tracking middleware for all authenticated routes
router.use(trackActivity);

/**
 * An array of route objects, each with a path and a router.
 * @type {Array<object>}
 */
const defaultRoutes = [
  {
    path: '/auth',
    route: authRouter,
  },
  {
    path: '/users',
    route: userRouter,
  },
  {
    path: '/cities',
    route: cityRoute,
  },
  {
    path: '/services',
    route: serviceRoute,
  },
  {
    path: '/service-requests',
    route: serviceRequestRoute,
  },
  {
    path: '/notifications',
    route: notificationRoute,
  },
  {
    path: '/reviews',
    route: reviewRoute,
  },
  {
    path: '/providers',
    route: providerRoute,
  },
  {
    path: '/clients',
    route: clientRoute,
  },
  {
    path: '/reports',
    route: reportRoute,
  },
  {
    path: '/blocks',
    route: blockRoute,
  },
  {
    path: '/chat',
    route: chatRoute,
  },
  {
    path: '/offers',
    route: offerRoute,
  },
  {
    path: '/presence',
    route: presenceRoute,
  },
  {
    path: '/maintenance',
    route: maintenanceRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/**
 * The main router for the application.
 * @exports routes
 * @type {object}
 */
module.exports = router;