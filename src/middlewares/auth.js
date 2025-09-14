const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

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

module.exports = {
    authenticate,
    authorize,
    optionalAuth
}