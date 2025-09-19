const bcrypt = require('bcryptjs');
const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password with bcrypt', async () => {
      const password = 'mySecretPassword';
      const hashedPassword = 'hashed-password';
      
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      
      const result = await hashPassword(password);
      
      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 8);
    });
  });

  describe('comparePassword', () => {
    it('should return true when passwords match', async () => {
      const password = 'mySecretPassword';
      const hashedPassword = 'hashed-password';
      
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      
      const result = await comparePassword(password, hashedPassword);
      
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should return false when passwords do not match', async () => {
      const password = 'mySecretPassword';
      const hashedPassword = 'hashed-password';
      
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
      
      const result = await comparePassword(password, hashedPassword);
      
      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });
  });
});