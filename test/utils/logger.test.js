const logger = require('../../src/utils/logger');

describe('Logger', () => {
  it('should export a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('should have log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
});