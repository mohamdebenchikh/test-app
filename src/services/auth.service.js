/**
 * @fileoverview Authentication services for user registration and login.
 * @module services/auth
 */

const httpStatus = require('http-status');
const userService = require('./user.service');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');
const { comparePassword } = require('../utils/password');
const { User, Token } = require('../models');

/**
 * Registers a new user.
 * @function register
 * @param {object} userBody - The user's data.
 * @returns {Promise<{user: User, tokens: object}>} - An object containing the created user and authentication tokens.
 */
const register = async (userBody) => {
  const user = await userService.createUser(userBody);
  const tokens = await tokenService.generateAuthTokens(user);
  return { user, tokens };
};

/**
 * Logs in a user with their email and password.
 * @function loginUserWithEmailAndPassword
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<User>} - The authenticated user.
 * @throws {ApiError} - If the email or password is incorrect.
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'errors.incorrectEmailOrPassword');
  }
  return user;
};

const forgotPassword = async (email) => {
    const resetPasswordToken = await tokenService.generateResetPasswordToken(email);
    await emailService.sendResetPasswordEmail(email, resetPasswordToken);
};

const resetPassword = async (resetPasswordToken, newPassword) => {
    try {
        const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, 'resetPassword');
        const user = await userService.getUserById(resetPasswordTokenDoc.user_id);
        if (!user) {
            throw new Error();
        }
        await userService.updateUserById(user.id, { password: newPassword });
        await Token.destroy({ where: { user_id: user.id, type: 'resetPassword' } });
    } catch (error) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
    }
};

module.exports = {
  register,
  loginUserWithEmailAndPassword,
  forgotPassword,
  resetPassword,
};
