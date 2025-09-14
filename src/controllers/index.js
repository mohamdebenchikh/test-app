/**
 * @fileoverview Barrel file for exporting all controllers.
 * @module controllers
 */

module.exports = {
  /**
   * The authentication controller.
   * @type {object}
   */
  authController: require('./auth.controller'),
  /**
   * The user controller.
   * @type {object}
   */
  userController: require('./user.controller'),
};
