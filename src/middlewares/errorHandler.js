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
      try {
        details.push(t(joiError.message));
      } catch (e) {
        details.push(joiError.message);
      }
    }
    return res.status(400).json({
      success: false,
      message: t("errors.validationError"),
      errors: details,
    });
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => {
      try {
        return t(e.message);
      } catch (ex) {
        return e.message;
      }
    });
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
      message: t("errors.resourceExists")
    });
  }

  // Known ApiError
  if (err instanceof ApiError) {
    // Try to translate the message, but fall back to the original message if translation fails
    let message = err.message;
    try {
      message = t(err.message);
    } catch (e) {
      // If translation fails, use the original message
    }
    
    // Ensure we have a valid status code
    const statusCode = err.statusCode || 500;
    
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  if (process.env.NODE_ENV === 'development') {
    // Try to translate the message, but fall back to the original message if translation fails
    let message = "errors.internalServerError";
    try {
      message = t("errors.internalServerError");
    } catch (e) {
      // If translation fails, use a default message
      message = "Internal Server Error";
    }
    return res.status(500).json({
      success: false,
      message,
      stack: err.stack // Only in dev
    });
  }

  // Unexpected errors
  // Try to translate the message, but fall back to the original message if translation fails
  let message = "errors.internalServerError";
  try {
    message = t("errors.internalServerError");
  } catch (e) {
    // If translation fails, use a default message
    message = "Internal Server Error";
  }
  res.status(500).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;