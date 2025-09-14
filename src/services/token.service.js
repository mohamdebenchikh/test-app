/**
 * @fileoverview Services for generating JWT tokens.
 * @module services/token
 */

const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config/auth');
const { tokenTypes } = require('../config/tokens');
const { User } = require('../models');

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

module.exports = {
  generateToken,
  generateAuthTokens,
};
