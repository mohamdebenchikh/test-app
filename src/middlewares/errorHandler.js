const { isCelebrateError } = require("celebrate");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");


function errorHandler(err, req, res, next) {

  logger.error(err); // log error with stack trace

  // Joi validation errors
  if (isCelebrateError(err)) {
    const details = [];
    for (const [segment, joiError] of err.details.entries()) {
      details.push(joiError.message);
    }
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: details,
    });
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => e.message);
    return res.status(400).json({
      success: false,
      message: "Database validation error",
      errors
    });
  }


  // Unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: "Resource already exists"
    });
  }

  // Known ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      stack: err.stack // Only in dev
    });
  }

  // Unexpected errors
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}

module.exports = errorHandler;
