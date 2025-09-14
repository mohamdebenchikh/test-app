/**
 * @fileoverview Authentication and authorization middleware.
 * @module middlewares/auth
 */

const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

/**
 * Middleware to authenticate a user with a JWT.
 * @function authenticate
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new ApiError(401, 'Access token is required');
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = verifyToken(token);

        req.user = decoded; // Add user info to request
        next();
    } catch (error) {
        if (error instanceof ApiError) {
            return next(error);
        }
        next(new ApiError(401, 'Invalid or expired token'));
    }
};

/**
 * Middleware for optional authentication. If a valid token is provided, user info is added to the request.
 * If not, the request proceeds without authentication.
 * @function optionalAuth
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 * @returns {void}
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            req.user = decoded;
        }

        next(); // Continue regardless of token validity
    } catch (error) {
        next(); // Continue without user info
    }
};

/**
 * @function authorize
 * @description This is a placeholder for a role-based authorization middleware. It is not yet implemented.
 * @param {string[]} requiredRoles - An array of roles that are allowed to access the route.
 * @returns {function} - The middleware function.
 */
const authorize = (requiredRoles) => (req, res, next) => {
    // This is a placeholder. The actual implementation should check the user's role.
    // For now, it does nothing and just calls next().
    next();
};

/**
 * @exports middlewares/auth
 * @type {object}
 * @property {function} authenticate - Middleware to authenticate a user with a JWT.
 * @property {function} authorize - Placeholder for a role-based authorization middleware.
 * @property {function} optionalAuth - Middleware for optional authentication.
 */
module.exports = {
    authenticate,
    authorize,
    optionalAuth
}