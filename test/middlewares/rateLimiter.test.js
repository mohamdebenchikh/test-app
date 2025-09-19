const { RateLimiterMemory } = require('rate-limiter-flexible');

// Mock rate-limiter-flexible
jest.mock('rate-limiter-flexible', () => {
  const mockRateLimiter = {
    consume: jest.fn()
  };
  
  return {
    RateLimiterMemory: jest.fn(() => mockRateLimiter)
  };
});

// Now import the middleware after mocking
const rateLimiterMiddleware = require('../../src/middlewares/rateLimiter');

describe('Rate Limiter Middleware', () => {
  let req, res, next;
  let mockRateLimiter;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      connection: {},
      socket: {}
    };
    res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    // Get the mock rate limiter instance
    mockRateLimiter = new RateLimiterMemory();
    
    jest.clearAllMocks();
  });

  it('should call next() when rate limit is not exceeded', (done) => {
    // Mock successful consumption
    mockRateLimiter.consume.mockResolvedValueOnce({});
    
    rateLimiterMiddleware(req, res, () => {
      expect(mockRateLimiter.consume).toHaveBeenCalledWith('127.0.0.1');
      done();
    });
  }, 10000);

  it('should return 429 when rate limit is exceeded', (done) => {
    // Mock rate limit exceeded
    const rateLimiterRes = {
      msBeforeNext: 5000
    };
    mockRateLimiter.consume.mockRejectedValueOnce(rateLimiterRes);
    
    // Override next to make sure it's not called
    const originalNext = next;
    next = jest.fn(() => {
      // This should not be called
      done(new Error('next() should not be called when rate limit is exceeded'));
    });
    
    rateLimiterMiddleware(req, res, next);
    
    // Check the response after a short delay to allow the async operation to complete
    setTimeout(() => {
      try {
        expect(mockRateLimiter.consume).toHaveBeenCalledWith('127.0.0.1');
        expect(res.set).toHaveBeenCalledWith('Retry-After', '5');
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Too many requests',
          retryAfter: 5
        });
        expect(next).not.toHaveBeenCalled();
        done();
      } catch (error) {
        done(error);
      }
    }, 10);
  }, 10000);

  it('should get IP from connection.remoteAddress if req.ip is not available', (done) => {
    req.ip = undefined;
    req.connection.remoteAddress = '192.168.1.1';
    
    mockRateLimiter.consume.mockResolvedValueOnce({});
    
    rateLimiterMiddleware(req, res, () => {
      expect(mockRateLimiter.consume).toHaveBeenCalledWith('192.168.1.1');
      done();
    });
  }, 10000);

  it('should get IP from socket.remoteAddress if other sources are not available', (done) => {
    req.ip = undefined;
    req.connection.remoteAddress = undefined;
    req.socket.remoteAddress = '10.0.0.1';
    
    mockRateLimiter.consume.mockResolvedValueOnce({});
    
    rateLimiterMiddleware(req, res, () => {
      expect(mockRateLimiter.consume).toHaveBeenCalledWith('10.0.0.1');
      done();
    });
  }, 10000);

  it('should return 1 as retryAfter if msBeforeNext is less than 1000', (done) => {
    const rateLimiterRes = {
      msBeforeNext: 500 // Less than 1000ms
    };
    mockRateLimiter.consume.mockRejectedValueOnce(rateLimiterRes);
    
    // Override next to make sure it's not called
    next = jest.fn(() => {
      // This should not be called
      done(new Error('next() should not be called when rate limit is exceeded'));
    });
    
    rateLimiterMiddleware(req, res, next);
    
    // Check the response after a short delay to allow the async operation to complete
    setTimeout(() => {
      try {
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Too many requests',
          retryAfter: 1 // Should be 1, not 0
        });
        done();
      } catch (error) {
        done(error);
      }
    }, 10);
  }, 10000);
});