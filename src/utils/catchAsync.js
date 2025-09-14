/**
 * @fileoverview A utility function for catching errors in async Express route handlers.
 * @module utils/catchAsync
 */

/**
 * Wraps an async function in a try-catch block, passing any errors to the `next` middleware.
 * @function catchAsync
 * @param {function} fn - The async function to wrap.
 * @returns {function} A new function that handles errors.
 */
module.exports = function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};