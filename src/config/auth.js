/**
 * @fileoverview Configuration for JWT authentication.
 * @module config/auth
 */

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * @exports config/auth
 * @type {object}
 * @property {object} jwt - JWT configuration.
 * @property {string} jwt.secret - The secret key for signing JWTs.
 * @property {number} jwt.accessExpirationMinutes - The expiration time for access tokens in minutes.
 */
module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpirationMinutes: process.env.JWT_ACCESS_EXPIRATION_MINUTES || 30,
  },
};
