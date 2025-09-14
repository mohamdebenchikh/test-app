/**
 * @fileoverview Barrel file for exporting all services.
 * @module services
 */

module.exports = {
  /**
   * The authentication service.
   * @type {object}
   */
  authService: require('./auth.service'),
  /**
   * The user service.
   * @type {object}
   */
  userService: require('./user.service'),
  /**
   * The token service.
   * @type {object}
   */
  tokenService: require('./token.service'),
};
