/**
 * @fileoverview Utility functions for working with JSON Web Tokens (JWT).
 * @module utils/jwt
 */

const jwt = require('jsonwebtoken');

/**
 * Generates a new JWT.
 * @function generateToken
 * @param {object} payload - The payload to sign. It should include `sub` (user ID) and can include `language`.
 * @returns {string} The generated JWT.
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'your-app-name',
    audience: 'your-app-users'
  });
};

/**
 * Verifies a JWT.
 * @function verifyToken
 * @param {string} token - The JWT to verify.
 * @returns {object} The decoded payload of the token.
 * @throws {Error} If the token is invalid or expired.
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generates a new refresh token.
 * @function refreshToken
 * @param {object} payload - The payload to sign.
 * @returns {string} The generated refresh token.
 */
const refreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d' // Longer expiry for refresh tokens
  });
};

module.exports = {
  generateToken,
  verifyToken,
  refreshToken
};