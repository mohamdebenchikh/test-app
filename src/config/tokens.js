/**
 * @fileoverview Defines the types of tokens used in the application.
 * @module config/tokens
 */

/**
 * An enumeration of token types.
 * @enum {string}
 */
const tokenTypes = {
  /** @property {string} ACCESS - Represents an access token. */
  ACCESS: 'access',
  /** @property {string} REFRESH - Represents a refresh token. */
  REFRESH: 'refresh',
  /** @property {string} RESET_PASSWORD - Represents a reset password token. */
  RESET_PASSWORD: 'resetPassword',
  /** @property {string} VERIFY_EMAIL - Represents an email verification token. */
  VERIFY_EMAIL: 'verifyEmail',
};

/**
 * @exports config/tokens
 * @type {object}
 * @property {object} tokenTypes - An enumeration of token types.
 */
module.exports = {
  tokenTypes,
};
