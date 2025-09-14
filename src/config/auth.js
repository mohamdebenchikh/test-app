/**
 * @fileoverview Configuration for JWT authentication.
 * @module config/auth
 */

const config = require('./config');

/**
 * @exports config/auth
 * @type {object}
 * @property {object} jwt - JWT configuration.
 * @property {string} jwt.secret - The secret key for signing JWTs.
 * @property {number} jwt.accessExpirationMinutes - The expiration time for access tokens in minutes.
 */
module.exports = {
  jwt: config.jwt,
};
