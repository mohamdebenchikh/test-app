/**
 * @fileoverview Main router for the application.
 * @module routes
 */

const express = require('express');
const authRouter = require('./auth.route');
const userRouter = require('./user.route');
const cityRoute = require('./city.route');
const serviceRoute = require('./service.route');

const router = express.Router();

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
    path: '/services',
    route: serviceRoute,
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
