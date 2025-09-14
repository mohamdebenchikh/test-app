/**
 * @fileoverview Global error handler middleware.
 * @module middlewares/errorHandler
 */

const { isCelebrateError } = require("celebrate");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

/**
 * Global error handler middleware. This function catches and processes errors from all over the application.
 * @function errorHandler
 * @param {Error} err - The error object.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
function errorHandler(err, req, res, next) {
  const { t } = req;
  logger.error(err); // log error with stack trace

  // Joi validation errors
  if (isCelebrateError(err)) {
    const details = [];
    for (const [segment, joiError] of err.details.entries()) {
      details.push(t(joiError.message));
    }
    return res.status(400).json({
      success: false,
      message: t("errors.validationError"),
      errors: details,
    });
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => t(e.message));
    return res.status(400).json({
      success: false,
      message: t("errors.validationError"),
      errors
    });
  }


  // Unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: t("errors.resourceExists") // I need to add this key to my translation files
    });
  }

  // Known ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: t(err.message),
    });
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      message: t("errors.internalServerError"), // I need to add this key
      stack: err.stack // Only in dev
    });
  }

  // Unexpected errors
  res.status(500).json({
    success: false,
    message: t("errors.internalServerError"),
  });
}

module.exports = errorHandler;
