const logger = require('../../utils/logger');

/**
 * Abstract base class for OAuth providers
 * Defines the standardized interface that all OAuth providers must implement
 */
class BaseOAuthProvider {
  /**
   * Create a new OAuth provider instance
   * @param {string} providerName - Name of the OAuth provider (e.g., 'google', 'facebook')
   * @param {Object} config - Provider configuration from OAuthConfigManager
   */
  constructor(providerName, config) {
    if (this.constructor === BaseOAuthProvider) {
      throw new Error('BaseOAuthProvider is an abstract class and cannot be instantiated directly');
    }

    this.providerName = providerName;
    this.config = config;
    this.strategy = null;
    
    // Validate required configuration
    this.validateConfig();
  }

  /**
   * Validate provider configuration
   * Override in subclasses for provider-specific validation
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.config) {
      throw new Error(`Configuration is required for ${this.providerName} provider`);
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error(`Client ID and secret are required for ${this.providerName} provider`);
    }

    if (!this.config.callbackURL) {
      throw new Error(`Callback URL is required for ${this.providerName} provider`);
    }
  }

  /**
   * Get the Passport strategy for this provider
   * Must be implemented by subclasses
   * @returns {Strategy} Passport strategy instance
   * @abstract
   */
  getStrategy() {
    throw new Error(`getStrategy() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Normalize user profile from provider to standard format
   * Must be implemented by subclasses
   * @param {Object} profile - Raw profile from OAuth provider
   * @returns {Object} Normalized profile object
   * @abstract
   */
  normalizeProfile(profile) {
    throw new Error(`normalizeProfile() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Get authorization URL for this provider
   * Can be overridden by subclasses for custom behavior
   * @param {Object} req - Express request object
   * @param {Object} options - Additional options for authorization
   * @returns {string} Authorization URL
   */
  getAuthUrl(req, options = {}) {
    // Default implementation - most providers will use Passport's authenticate method
    // This is primarily for informational purposes or custom implementations
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/api/oauth/${this.providerName}`;
  }

  /**
   * Handle OAuth callback
   * Can be overridden by subclasses for custom callback handling
   * @param {Object} profile - Normalized user profile
   * @param {Function} done - Passport done callback
   * @returns {Promise} Promise that resolves when callback is handled
   */
  async handleCallback(profile, done) {
    try {
      // Default callback handling - normalize profile and pass to done
      const normalizedProfile = this.normalizeProfile(profile);
      
      logger.debug(`OAuth callback for ${this.providerName}:`, {
        provider: this.providerName,
        userId: normalizedProfile.id,
        email: normalizedProfile.email
      });

      return done(null, normalizedProfile);
    } catch (error) {
      logger.error(`OAuth callback error for ${this.providerName}:`, error);
      return done(error, null);
    }
  }

  /**
   * Get provider-specific error handler
   * Can be overridden by subclasses for custom error handling
   * @param {Error} error - Original error
   * @returns {Error} Processed error
   */
  handleError(error) {
    // Default error handling - wrap in provider-specific error
    const { OAuthError } = require('../utils/OAuthError');
    return new OAuthError(this.providerName, error);
  }

  /**
   * Get provider display name for UI
   * Can be overridden by subclasses
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.providerName.charAt(0).toUpperCase() + this.providerName.slice(1);
  }

  /**
   * Get provider configuration (without sensitive data)
   * @returns {Object} Safe configuration object
   */
  getSafeConfig() {
    const { clientSecret, consumerSecret, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      provider: this.providerName,
      displayName: this.getDisplayName(),
      hasClientSecret: !!clientSecret || !!consumerSecret
    };
  }

  /**
   * Initialize the provider
   * Called when the provider is registered with the factory
   * Can be overridden by subclasses for custom initialization
   */
  initialize() {
    logger.debug(`Initializing ${this.providerName} OAuth provider`);
    
    // Create and cache the strategy
    this.strategy = this.getStrategy();
    
    if (!this.strategy) {
      throw new Error(`Failed to create strategy for ${this.providerName} provider`);
    }

    logger.info(`${this.providerName} OAuth provider initialized successfully`);
  }

  /**
   * Cleanup provider resources
   * Called when the provider is being destroyed
   * Can be overridden by subclasses for custom cleanup
   */
  destroy() {
    logger.debug(`Destroying ${this.providerName} OAuth provider`);
    this.strategy = null;
  }

  /**
   * Check if provider supports a specific feature
   * Can be overridden by subclasses to indicate feature support
   * @param {string} feature - Feature name (e.g., 'pkce', 'refresh_token')
   * @returns {boolean} True if feature is supported
   */
  supportsFeature(feature) {
    // Default implementation - no special features supported
    return false;
  }

  /**
   * Get OAuth scopes for this provider
   * @returns {Array<string>|string} OAuth scopes
   */
  getScopes() {
    return this.config.scope || [];
  }

  /**
   * Get provider metadata for debugging and monitoring
   * @returns {Object} Provider metadata
   */
  getMetadata() {
    return {
      provider: this.providerName,
      displayName: this.getDisplayName(),
      enabled: this.config.enabled !== false,
      callbackURL: this.config.callbackURL,
      scopes: this.getScopes(),
      features: {
        pkce: this.supportsFeature('pkce'),
        refreshToken: this.supportsFeature('refresh_token'),
        emailVerification: this.supportsFeature('email_verification')
      },
      initialized: !!this.strategy
    };
  }
}

module.exports = BaseOAuthProvider;