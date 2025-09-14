/**
 * @fileoverview Middleware for rate limiting API requests.
 * @module middlewares/rateLimiter
 */

const { RateLimiterMemory } = require("rate-limiter-flexible");

/**
 * The rate limiter instance.
 * @type {RateLimiterMemory}
 */
const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per minute (more reasonable)
});

/**
 * Gets the client's IP address from the request object.
 * @function getClientIp
 * @param {object} req - The Express request object.
 * @returns {string|null} The client's IP address or null if not found.
 */
const getClientIp = (req) => {
  return req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

/**
 * Rate limiting middleware.
 * @function
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
module.exports = (req, res, next) => {

  rateLimiter.consume(getClientIp(req))
    .then(() => {
      next();
    })
    .catch((rateLimiterRes) => {
      const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: secs
      });
    });
};
