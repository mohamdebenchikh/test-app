const { createTestConfig } = require('./testConfig');

describe('Configuration System', () => {
  const getValidBaseEnv = () => ({
    NODE_ENV: 'test',
    PORT: 3000,
    JWT_SECRET: 'test-secret',
  });

  describe('Portfolio Configuration Validation', () => {
    describe('Local Storage Configuration', () => {
      test('should accept valid local storage configuration', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
          STORAGE_TYPE: 'local',
          STORAGE_LOCAL_PATH: 'uploads/custom-portfolio',
          PORTFOLIO_MAX_IMAGES: 15,
          PORTFOLIO_MAX_FILE_SIZE: 10485760,
          PORTFOLIO_ALLOWED_TYPES: 'jpeg,png,webp',
        });
        
        expect(config.portfolio.storage.type).toBe('local');
        expect(config.portfolio.storage.local.path).toBe('uploads/custom-portfolio');
        expect(config.portfolio.limits.maxImages).toBe(15);
        expect(config.portfolio.limits.maxFileSize).toBe(10485760);
        expect(config.portfolio.limits.allowedTypes).toEqual(['jpeg', 'png', 'webp']);
      });

      test('should use default values for local storage when not specified', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
        });
        
        expect(config.portfolio.storage.type).toBe('local');
        expect(config.portfolio.storage.local.path).toBe('uploads/portfolio');
        expect(config.portfolio.limits.maxImages).toBe(10);
        expect(config.portfolio.limits.maxFileSize).toBe(5242880);
        expect(config.portfolio.limits.allowedTypes).toEqual(['jpeg', 'jpg', 'png', 'webp']);
      });

      test('should not require AWS credentials for local storage', () => {
        expect(() => {
          createTestConfig({
            ...getValidBaseEnv(),
            STORAGE_TYPE: 'local',
          });
        }).not.toThrow();
      });
    });

    describe('S3 Storage Configuration', () => {
      test('should accept valid S3 configuration', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
          STORAGE_TYPE: 's3',
          STORAGE_S3_BUCKET: 'test-portfolio-bucket',
          STORAGE_S3_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test-access-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret-key',
        });
        
        expect(config.portfolio.storage.type).toBe('s3');
        expect(config.portfolio.storage.s3.bucket).toBe('test-portfolio-bucket');
        expect(config.portfolio.storage.s3.region).toBe('us-east-1');
        expect(config.portfolio.storage.s3.accessKeyId).toBe('test-access-key');
        expect(config.portfolio.storage.s3.secretAccessKey).toBe('test-secret-key');
      });

      test('should require S3 bucket when storage type is s3', () => {
        expect(() => {
          createTestConfig({
            ...getValidBaseEnv(),
            STORAGE_TYPE: 's3',
            STORAGE_S3_REGION: 'us-east-1',
            AWS_ACCESS_KEY_ID: 'test-access-key',
            AWS_SECRET_ACCESS_KEY: 'test-secret-key',
          });
        }).toThrow(/STORAGE_S3_BUCKET.*required/);
      });

      test('should require S3 region when storage type is s3', () => {
        expect(() => {
          createTestConfig({
            ...getValidBaseEnv(),
            STORAGE_TYPE: 's3',
            STORAGE_S3_BUCKET: 'test-bucket',
            AWS_ACCESS_KEY_ID: 'test-access-key',
            AWS_SECRET_ACCESS_KEY: 'test-secret-key',
          });
        }).toThrow(/STORAGE_S3_REGION.*required/);
      });

      test('should require AWS access key ID when storage type is s3', () => {
        expect(() => {
          createTestConfig({
            ...getValidBaseEnv(),
            STORAGE_TYPE: 's3',
            STORAGE_S3_BUCKET: 'test-bucket',
            STORAGE_S3_REGION: 'us-east-1',
            AWS_SECRET_ACCESS_KEY: 'test-secret-key',
          });
        }).toThrow(/AWS_ACCESS_KEY_ID.*required/);
      });

      test('should require AWS secret access key when storage type is s3', () => {
        expect(() => {
          createTestConfig({
            ...getValidBaseEnv(),
            STORAGE_TYPE: 's3',
            STORAGE_S3_BUCKET: 'test-bucket',
            STORAGE_S3_REGION: 'us-east-1',
            AWS_ACCESS_KEY_ID: 'test-access-key',
          });
        }).toThrow(/AWS_SECRET_ACCESS_KEY.*required/);
      });
    });

    describe('Storage Type Validation', () => {
      test('should reject invalid storage type', () => {
        expect(() => {
          createTestConfig({
            ...getValidBaseEnv(),
            STORAGE_TYPE: 'invalid-storage',
          });
        }).toThrow(/STORAGE_TYPE.*must be one of/);
      });

      test('should accept valid storage types', () => {
        const validTypes = ['local', 's3'];
        
        validTypes.forEach(type => {
          const envVars = {
            ...getValidBaseEnv(),
            STORAGE_TYPE: type,
          };

          if (type === 's3') {
            envVars.STORAGE_S3_BUCKET = 'test-bucket';
            envVars.STORAGE_S3_REGION = 'us-east-1';
            envVars.AWS_ACCESS_KEY_ID = 'test-key';
            envVars.AWS_SECRET_ACCESS_KEY = 'test-secret';
          }

          expect(() => {
            createTestConfig(envVars);
          }).not.toThrow();
        });
      });
    });

    describe('Portfolio Limits Validation', () => {
      test('should accept valid numeric limits', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
          PORTFOLIO_MAX_IMAGES: 20,
          PORTFOLIO_MAX_FILE_SIZE: 10485760,
        });
        
        expect(config.portfolio.limits.maxImages).toBe(20);
        expect(config.portfolio.limits.maxFileSize).toBe(10485760);
      });

      test('should handle allowed types string correctly', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
          PORTFOLIO_ALLOWED_TYPES: 'jpeg, png, webp, gif',
        });
        
        expect(config.portfolio.limits.allowedTypes).toEqual(['jpeg', 'png', 'webp', 'gif']);
      });

      test('should handle single allowed type', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
          PORTFOLIO_ALLOWED_TYPES: 'jpeg',
        });
        
        expect(config.portfolio.limits.allowedTypes).toEqual(['jpeg']);
      });
    });

    describe('Configuration Structure', () => {
      test('should have correct portfolio configuration structure', () => {
        const config = createTestConfig({
          ...getValidBaseEnv(),
          STORAGE_TYPE: 's3',
          STORAGE_S3_BUCKET: 'test-bucket',
          STORAGE_S3_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret',
        });
        
        expect(config.portfolio).toBeDefined();
        expect(config.portfolio.storage).toBeDefined();
        expect(config.portfolio.storage.type).toBeDefined();
        expect(config.portfolio.storage.local).toBeDefined();
        expect(config.portfolio.storage.s3).toBeDefined();
        expect(config.portfolio.limits).toBeDefined();
        expect(config.portfolio.limits.maxImages).toBeDefined();
        expect(config.portfolio.limits.maxFileSize).toBeDefined();
        expect(config.portfolio.limits.allowedTypes).toBeDefined();
      });

      test('should maintain existing configuration structure', () => {
        const config = createTestConfig(getValidBaseEnv());
        
        // Ensure existing config sections are still present
        expect(config.env).toBeDefined();
        expect(config.port).toBeDefined();
        expect(config.jwt).toBeDefined();
        expect(config.email).toBeDefined();
      });
    });
  });
});