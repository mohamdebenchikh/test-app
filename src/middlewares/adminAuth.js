const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

const authenticateAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new ApiError(401, 'Access token is required');
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = verifyToken(token);

        req.admin = decoded; // Add admin info to request
        next();
    } catch (error) {
        if (error instanceof ApiError) {
            return next(error);
        }
        next(new ApiError(401, 'Invalid or expired token'));
    }
};

const authorizeAdmin = () => (req, res, next) => {
    if (!req.admin) {
        return next(new ApiError(401, 'Authentication required'));
    }
    next();
};

const adminAuth = () => {
    return [authenticateAdmin, authorizeAdmin()];
};

module.exports = {
    authenticateAdmin,
    authorizeAdmin,
    adminAuth,
};
