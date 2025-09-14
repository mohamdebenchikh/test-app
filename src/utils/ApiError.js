class ApiError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // e.g., 'USER_NOT_FOUND', 'INVALID_CREDENTIALS'
    Error.captureStackTrace(this, this.constructor);
  }


  static badRequest(message = 'Bad Request') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static notFound(message = 'Not Found') {
    return new ApiError(404, message);
  }

  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message);
  }
}
module.exports = ApiError;
