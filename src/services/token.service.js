/**
 * @fileoverview Services for generating JWT tokens.
 * @module services/token
 */

const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config/config');
const { tokenTypes } = require('../config/tokens');
const { User, Admin, Token } = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * Generates a JWT token.
 * @function generateToken
 * @param {string} userId - The ID of the user.
 * @param {moment.Moment} expires - The expiration date of the token.
 * @param {string} type - The type of the token.
 * @param {string} [secret=config.jwt.secret] - The secret key for signing the token.
 * @returns {string} The generated JWT token.
 */
const generateToken = (userId, expires, type, payload = {}, secret = config.jwt.secret) => {
  const tokenPayload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
    ...payload,
  };
  return jwt.sign(tokenPayload, secret);
};

/**
 * Generates authentication tokens for a user.
 * @function generateAuthTokens
 * @param {User} user - The user object.
 * @returns {Promise<object>} An object containing the access token and its expiration date.
 */
const generateAuthTokens = async (user) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS, { language: user.language });

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
  };
};

const saveToken = async (token, userId, expires, type, blacklisted = false) => {
    const tokenDoc = await Token.create({
        token,
        user_id: userId,
        expires: expires.toDate(),
        type,
        blacklisted,
    });
    return tokenDoc;
};

const verifyToken = async (token, type) => {
    const payload = jwt.verify(token, config.jwt.secret);
    const tokenDoc = await Token.findOne({ where: { token, type, user_id: payload.sub, blacklisted: false } });
    if (!tokenDoc) {
        throw new Error('Token not found');
    }
    return tokenDoc;
};

const generateResetPasswordToken = async (email) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'No users found with this email');
    }
    const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
    const resetPasswordToken = generateToken(user.id, expires, tokenTypes.RESET_PASSWORD);
    await saveToken(resetPasswordToken, user.id, expires, tokenTypes.RESET_PASSWORD);
    return resetPasswordToken;
};

const generateAdminAuthTokens = async (admin) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(admin.id, accessTokenExpires, tokenTypes.ACCESS);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
  };
};

module.exports = {
  generateToken,
  generateAuthTokens,
  saveToken,
  verifyToken,
  generateResetPasswordToken,
  generateAdminAuthTokens,
};
