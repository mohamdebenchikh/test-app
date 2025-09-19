const validate = require('../../src/middlewares/validate');
const { celebrate } = require('celebrate');

// Mock celebrate
jest.mock('celebrate', () => {
  return {
    celebrate: jest.fn(() => (req, res, next) => next())
  };
});

describe('Validate Middleware', () => {
  let schema, options;

  beforeEach(() => {
    schema = {
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    };
    options = {
      abortEarly: false,
      stripUnknown: true
    };
    jest.clearAllMocks();
  });

  it('should call celebrate with the provided schema', () => {
    validate(schema);
    
    expect(celebrate).toHaveBeenCalledWith(schema, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });
  });

  it('should merge provided options with default options', () => {
    validate(schema, options);
    
    expect(celebrate).toHaveBeenCalledWith(schema, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
      ...options
    });
  });

  it('should return a middleware function', () => {
    const middleware = validate(schema);
    
    expect(typeof middleware).toBe('function');
    
    // Test that the middleware calls next
    const req = {};
    const res = {};
    const next = jest.fn();
    
    middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
});