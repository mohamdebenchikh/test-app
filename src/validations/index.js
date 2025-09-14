/**
 * @fileoverview Barrel file for exporting all validation schemas.
 * @module validations
 */

module.exports = {
  /**
   * The authentication validation schemas.
   * @type {object}
   */
  authValidation: require('./auth.validation'),
  /**
   * The user validation schemas.
   * @type {object}
   */
  userValidation: require('./user.validation'),
};
