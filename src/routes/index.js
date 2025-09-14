/**
 * @fileoverview Main router for the application.
 * @module routes
 */

const express = require('express');
const authRouter = require('./auth.route');

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
