/**
 * @fileoverview Authentication controller for handling user registration and login.
 * @module controllers/auth
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, userService, tokenService } = require('../services');

/**
 * Handles user registration.
 * @function register
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @returns {Promise<void>}
 */
const register = catchAsync(async (req, res) => {
  const { user, tokens } = await authService.register(req.body);
  res.status(httpStatus.CREATED).send({ user, tokens });
});

/**
 * Handles user login.
 * @function login
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @returns {Promise<void>}
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

/**
 * @exports controllers/auth
 * @type {object}
 * @property {function} register - Handles user registration.
 * @property {function} login - Handles user login.
 */
const forgotPassword = catchAsync(async (req, res) => {
    await authService.forgotPassword(req.body.email);
    res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
    await authService.resetPassword(req.query.token, req.body.password);
    res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};
