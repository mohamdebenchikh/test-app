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
   * The service request validation schemas.
   * @type {object}
   */
  serviceRequestValidation: require('./serviceRequest.validation'),
  /**
   * The user validation schemas.
   * @type {object}
   */
  userValidation: require('./user.validation'),
  /**
   * The review validation schemas.
   * @type {object}
   */
  reviewValidation: require('./review.validation'),
  /**
   * The report validation schemas.
   * @type {object}
   */
  reportValidation: require('./report.validation'),
  /**
   * The block validation schemas.
   * @type {object}
   */
  blockValidation: require('./block.validation'),
  /**
   * The offer validation schemas.
   * @type {object}
   */
  offerValidation: require('./offer.validation'),
  /**
   * The portfolio validation schemas.
   * @type {object}
   */
  portfolioValidation: require('./portfolio.validation'),
};