const { RateLimiterMemory } = require("rate-limiter-flexible");

const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per minute (more reasonable)
});


const getClientIp = (req) => {
  return req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);
};


module.exports = (req, res, next) => {

  rateLimiter.consume(getClientIp(req))
    .then(() => {
      next();
    })
    .catch(() => {
      const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
      res.set('Retry-After', String(secs));
      res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: secs
      });
    });
};
