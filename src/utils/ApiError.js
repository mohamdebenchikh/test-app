/**
 * @fileoverview Defines a custom ApiError class for handling API errors.
 * @module utils/ApiError
 */

/**
 * @class ApiError
 * @extends Error
 * @classdesc A custom error class for API errors.
 */
class ApiError extends Error {
  /**
   * Creates an instance of ApiError.
   * @param {number} statusCode - The HTTP status code of the error.
   * @param {string} message - The error message.
   * @param {string|null} [code=null] - An optional error code (e.g., 'USER_NOT_FOUND').
   */
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // e.g., 'USER_NOT_FOUND', 'INVALID_CREDENTIALS'
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a new ApiError with a 400 status code.
   * @param {string} [message='Bad Request'] - The error message.
   * @returns {ApiError} A new ApiError instance.
   */
  static badRequest(message = 'Bad Request') {
    return new ApiError(400, message);
  }

  /**
   * Creates a new ApiError with a 401 status code.
   * @param {string} [message='Unauthorized'] - The error message.
   * @returns {ApiError} A new ApiError instance.
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  /**
   * Creates a new ApiError with a 404 status code.
   * @param {string} [message='Not Found'] - The error message.
   * @returns {ApiError} A new ApiError instance.
   */
  static notFound(message = 'Not Found') {
    return new ApiError(404, message);
  }

  /**
   * Creates a new ApiError with a 500 status code.
   * @param {string} [message='Internal Server Error'] - The error message.
   * @returns {ApiError} A new ApiError instance.
   */
  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message);
  }
}
module.exports = ApiError;