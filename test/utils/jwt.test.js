const jwt = require('jsonwebtoken');
const { generateToken, verifyToken, refreshToken } = require('../../src/utils/jwt');

// Mock the console.log to avoid unnecessary output
jest.spyOn(console, 'log').mockImplementation();

describe('JWT Utils', () => {
  const mockPayload = { sub: '123', language: 'en' };
  const mockToken = 'mocked-jwt-token';
  
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a JWT token with correct options', () => {
      // Mock jwt.sign to return a predictable value
      jest.spyOn(jwt, 'sign').mockReturnValue(mockToken);
      
      const token = generateToken(mockPayload);
      
      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret-key',
        {
          expiresIn: '24h',
          issuer: 'your-app-name',
          audience: 'your-app-users'
        }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return the decoded payload', () => {
      const decodedPayload = { sub: '123', language: 'en' };
      jest.spyOn(jwt, 'verify').mockReturnValue(decodedPayload);
      
      const result = verifyToken(mockToken);
      
      expect(result).toEqual(decodedPayload);
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-secret-key');
    });

    it('should throw an error for an invalid token', () => {
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => verifyToken(mockToken)).toThrow('Invalid or expired token');
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-secret-key');
    });
  });

  describe('refreshToken', () => {
    it('should generate a refresh token with correct options', () => {
      jest.spyOn(jwt, 'sign').mockReturnValue(mockToken);
      
      const token = refreshToken(mockPayload);
      
      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret-key',
        {
          expiresIn: '7d'
        }
      );
    });
  });
});