const { OAuthConfigManager } = require('../oauth/config');
const {
  ProviderNotEnabledError,
  OAuthConfigurationError,
} = require('../oauth/utils');

describe('OAuthConfigManager', () => {
  let originalEnv;
  let configManager;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear OAuth-related environment variables
    Object.keys(process.env).forEach(key => {
      if (key.includes('GOOGLE_') || key.includes('FACEBOOK_') || 
          key.includes('GITHUB_') || key.includes('TWITTER_')) {
        delete process.env[key];
      }
    });
    
    configManager = new OAuthConfigManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadProviderConfig', () => {
    it('should return null when provider credentials are missing', () => {
      const config = configManager.loadProviderConfig('google');
      expect(config).toBeNull();
    });

    it('should load Google OAuth configuration correctly', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      process.env.BASE_URL = 'https://example.com';

      const config = configManager.loadProviderConfig('google');
      
      expect(config).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        enabled: true,
        scope: 'profile email',
        callbackURL: 'https://example.com/api/oauth/google/callback'
      });
    });

    it('should load Facebook OAuth configuration correctly', () => {
      process.env.FACEBOOK_CLIENT_ID = 'test-fb-id';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-fb-secret';
      process.env.FACEBOOK_SCOPE = 'email,public_profile';

      const config = configManager.loadProviderConfig('facebook');
      
      expect(config).toEqual({
        clientId: 'test-fb-id',
        clientSecret: 'test-fb-secret',
        enabled: true,
        scope: 'email,public_profile',
        profileFields: 'id,name,email,picture',
        callbackURL: 'http://localhost:3000/api/oauth/facebook/callback'
      });
    });

    it('should load Twitter OAuth configuration correctly', () => {
      process.env.TWITTER_CLIENT_ID = 'test-twitter-key';
      process.env.TWITTER_CLIENT_SECRET = 'test-twitter-secret';
      process.env.TWITTER_INCLUDE_EMAIL = 'true';

      const config = configManager.loadProviderConfig('twitter');
      
      expect(config).toEqual({
        clientId: 'test-twitter-key',
        clientSecret: 'test-twitter-secret',
        consumerKey: 'test-twitter-key',
        consumerSecret: 'test-twitter-secret',
        enabled: true,
        includeEmail: true,
        callbackURL: 'http://localhost:3000/api/oauth/twitter/callback'
      });
    });

    it('should respect custom callback URLs', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      process.env.GOOGLE_CALLBACK_URL = 'https://custom.com/auth/google/callback';

      const config = configManager.loadProviderConfig('google');
      
      expect(config.callbackURL).toBe('https://custom.com/auth/google/callback');
    });
  });

  describe('validateProviderConfig', () => {
    it('should return false for null config', () => {
      const isValid = configManager.validateProviderConfig('google', null);
      expect(isValid).toBe(false);
    });

    it('should return false when client credentials are missing', () => {
      const config = { enabled: true };
      const isValid = configManager.validateProviderConfig('google', config);
      expect(isValid).toBe(false);
    });

    it('should return true for valid Google config', () => {
      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        callbackURL: 'https://example.com/callback'
      };
      const isValid = configManager.validateProviderConfig('google', config);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid callback URL', () => {
      const config = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        callbackURL: 'invalid-url'
      };
      const isValid = configManager.validateProviderConfig('google', config);
      expect(isValid).toBe(false);
    });

    it('should validate Twitter OAuth 1.0a configuration', () => {
      const validConfig = {
        clientId: 'test-key',
        clientSecret: 'test-secret',
        consumerKey: 'test-key',
        consumerSecret: 'test-secret'
      };
      const isValid = configManager.validateProviderConfig('twitter', validConfig);
      expect(isValid).toBe(true);
    });
  });

  describe('getEnabledProviders', () => {
    it('should return empty array when no providers are configured', () => {
      configManager.loadConfigurations();
      const enabled = configManager.getEnabledProviders();
      expect(enabled).toEqual([]);
    });

    it('should return enabled providers', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.FACEBOOK_CLIENT_ID = 'test-fb-id';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-fb-secret';

      configManager.loadConfigurations();
      const enabled = configManager.getEnabledProviders();
      
      expect(enabled).toContain('google');
      expect(enabled).toContain('facebook');
      expect(enabled.length).toBe(2);
    });

    it('should exclude disabled providers', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_ENABLED = 'false';

      configManager.loadConfigurations();
      const enabled = configManager.getEnabledProviders();
      
      expect(enabled).not.toContain('google');
    });
  });

  describe('isProviderEnabled', () => {
    it('should return false for unconfigured provider', () => {
      const isEnabled = configManager.isProviderEnabled('google');
      expect(isEnabled).toBe(false);
    });

    it('should return true for enabled provider', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

      configManager.loadConfigurations();
      const isEnabled = configManager.isProviderEnabled('google');
      expect(isEnabled).toBe(true);
    });

    it('should return false for explicitly disabled provider', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.GOOGLE_ENABLED = 'false';

      configManager.loadConfigurations();
      const isEnabled = configManager.isProviderEnabled('google');
      expect(isEnabled).toBe(false);
    });
  });

  describe('reloadConfigurations', () => {
    it('should detect newly enabled providers', () => {
      // Initially no providers
      configManager.loadConfigurations();
      expect(configManager.getEnabledProviders()).toEqual([]);

      // Add Google configuration
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

      const result = configManager.reloadConfigurations();
      
      expect(result.added).toContain('google');
      expect(result.enabled).toContain('google');
    });

    it('should detect disabled providers', () => {
      // Initially enable Google
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      configManager.loadConfigurations();
      expect(configManager.getEnabledProviders()).toContain('google');

      // Disable Google
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const result = configManager.reloadConfigurations();
      
      expect(result.removed).toContain('google');
      expect(result.enabled).not.toContain('google');
    });
  });

  describe('getConfigSummary', () => {
    it('should return configuration summary without sensitive data', () => {
      process.env.GOOGLE_CLIENT_ID = 'test-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
      process.env.FACEBOOK_CLIENT_ID = 'test-fb-id';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-fb-secret';

      configManager.loadConfigurations();
      const summary = configManager.getConfigSummary();

      expect(summary.supportedProviders).toEqual(['google', 'facebook', 'github', 'twitter']);
      expect(summary.enabledProviders).toContain('google');
      expect(summary.enabledProviders).toContain('facebook');
      
      expect(summary.configurations.google).toEqual({
        enabled: true,
        hasClientId: true,
        hasClientSecret: true,
        callbackURL: 'http://localhost:3000/api/oauth/google/callback',
        scope: 'profile email'
      });

      // Should not contain actual secrets
      expect(summary.configurations.google.clientId).toBeUndefined();
      expect(summary.configurations.google.clientSecret).toBeUndefined();
    });
  });
});