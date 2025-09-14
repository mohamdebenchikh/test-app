const httpStatus = require('http-status');
const userService = require('./user.service');
const tokenService = require('./token.service');
const ApiError = require('../utils/ApiError');
const { comparePassword } = require('../utils/password');

/**
 * Register a user
 * @param {Object} userBody
 * @returns {Promise<Object>}
 */
const register = async (userBody) => {
  const user = await userService.createUser(userBody);
  const tokens = await tokenService.generateAuthTokens(user);
  return { user, tokens };
};

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

module.exports = {
  register,
  loginUserWithEmailAndPassword,
};
