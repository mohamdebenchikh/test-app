const { authenticate, optionalAuth, authorize } = require('../../src/middlewares/auth');
const { verifyToken } = require('../../src/utils/jwt');
const ApiError = require('../../src/utils/ApiError');

// Mock the verifyToken function
jest.mock('../../src/utils/jwt', () => ({
  verifyToken: jest.fn()
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should throw ApiError if no authorization header', () => {
      authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Access token is required');
    });

    it('should throw ApiError if authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic someToken';
      
      authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Access token is required');
    });

    it('should throw ApiError if token is invalid', () => {
      req.headers.authorization = 'Bearer invalidToken';
      verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Invalid or expired token');
    });

    it('should call next() and add user to req if token is valid', () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      req.headers.authorization = 'Bearer validToken';
      verifyToken.mockReturnValue(mockUser);
      
      authenticate(req, res, next);
      
      expect(verifyToken).toHaveBeenCalledWith('validToken');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass through existing ApiError', () => {
      const apiError = new ApiError(403, 'Forbidden');
      req.headers.authorization = 'Bearer invalidToken';
      verifyToken.mockImplementation(() => {
        throw apiError;
      });
      
      authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledWith(apiError);
    });
  });

  describe('optionalAuth', () => {
    it('should not add user to req if no authorization header', () => {
      optionalAuth(req, res, next);
      
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should not add user to req if authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic someToken';
      
      optionalAuth(req, res, next);
      
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should not add user to req if token is invalid', () => {
      req.headers.authorization = 'Bearer invalidToken';
      verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      optionalAuth(req, res, next);
      
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should add user to req if token is valid', () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      req.headers.authorization = 'Bearer validToken';
      verifyToken.mockReturnValue(mockUser);
      
      optionalAuth(req, res, next);
      
      expect(verifyToken).toHaveBeenCalledWith('validToken');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('authorize', () => {
    it('should call next() without checking roles (placeholder implementation)', () => {
      const middleware = authorize(['admin']);
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
  });
});