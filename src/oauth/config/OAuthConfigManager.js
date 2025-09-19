const logger = require('../../utils/logger');

/**
 * OAuth Configuration Manager
 * Manages OAuth provider configurations from environment variables
 */
class OAuthConfigManager {
  constructor() {
    this.providers = new Map();
    this.supportedProviders = ['google', 'facebook', 'github', 'twitter'];
    this.loadConfigurations();
  }

  /**
   * Load configurations for all supported OAuth providers
   */
  loadConfigurations() {
    this.providers.clear();
    
    for (const providerName of this.supportedProviders) {
      try {
        const config = this.loadProviderConfig(providerName);
        if (config && this.validateProviderConfig(providerName, config)) {
          this.providers.set(providerName, config);
          logger.info(`OAuth provider ${providerName} enabled`);
        } else {
          logger.debug(`OAuth provider ${providerName} disabled - missing or invalid configuration`);
        }
      } catch (error) {
        logger.error(`Failed to load OAuth provider ${providerName}:`, error.message);
      }
    }
  }

  /**
   * Load configuration for a specific provider from environment variables
   * @param {string} providerName - Name of the OAuth provider
   * @returns {Object|null} Provider configuration or null if not configured
   */
  loadProviderConfig(providerName) {
    const upperProvider = providerName.toUpperCase();
    
    // Common configuration pattern for OAuth providers
    const clientId = process.env[`${upperProvider}_CLIENT_ID`];
    const clientSecret = process.env[`${upperProvider}_CLIENT_SECRET`];
    
    if (!clientId || !clientSecret) {
      return null;
    }

    const config = {
      clientId,
      clientSecret,
      enabled: process.env[`${upperProvider}_ENABLED`] !== 'false', // Default to true if not specified
    };

    // Provider-specific configurations
    switch (providerName) {
      case 'google':
        config.scope = process.env.GOOGLE_SCOPE || 'profile email';
        break;
      
      case 'facebook':
        config.scope = process.env.FACEBOOK_SCOPE || 'email';
        config.profileFields = process.env.FACEBOOK_PROFILE_FIELDS || 'id,name,email,picture';
        break;
      
      case 'github':
        config.scope = process.env.GITHUB_SCOPE || 'user:email';
        break;
      
      case 'twitter':
        // Twitter uses OAuth 1.0a, so it needs consumer key/secret instead
        config.consumerKey = clientId;
        config.consumerSecret = clientSecret;
        config.includeEmail = process.env.TWITTER_INCLUDE_EMAIL === 'true';
        break;
    }

    // Common callback URL pattern
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    config.callbackURL = process.env[`${upperProvider}_CALLBACK_URL`] || 
                        `${baseUrl}/api/oauth/${providerName}/callback`;

    return config;
  }

  /**
   * Validate provider configuration
   * @param {string} providerName - Name of the OAuth provider
   * @param {Object} config - Provider configuration
   * @returns {boolean} True if configuration is valid
   */
  validateProviderConfig(providerName, config) {
    if (!config) {
      return false;
    }

    // Basic validation - all providers need client credentials
    if (!config.clientId || !config.clientSecret) {
      logger.warn(`OAuth provider ${providerName} missing client credentials`);
      return false;
    }

    // Validate callback URL format
    if (config.callbackURL && !this.isValidUrl(config.callbackURL)) {
      logger.warn(`OAuth provider ${providerName} has invalid callback URL: ${config.callbackURL}`);
      return false;
    }

    // Provider-specific validation
    switch (providerName) {
      case 'twitter':
        // Twitter OAuth 1.0a validation
        if (!config.consumerKey || !config.consumerSecret) {
          logger.warn(`Twitter OAuth provider missing consumer key/secret`);
          return false;
        }
        break;
      
      case 'google':
      case 'facebook':
      case 'github':
        // OAuth 2.0 validation (already covered by basic validation)
        break;
      
      default:
        logger.warn(`Unknown OAuth provider: ${providerName}`);
        return false;
    }

    return true;
  }

  /**
   * Check if a URL is valid
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of enabled OAuth providers
   * @returns {Array<string>} Array of enabled provider names
   */
  getEnabledProviders() {
    return Array.from(this.providers.keys()).filter(provider => {
      const config = this.providers.get(provider);
      return config && config.enabled !== false;
    });
  }

  /**
   * Get configuration for a specific provider
   * @param {string} providerName - Name of the OAuth provider
   * @returns {Object|null} Provider configuration or null if not enabled
   */
  getProviderConfig(providerName) {
    const config = this.providers.get(providerName);
    return (config && config.enabled !== false) ? config : null;
  }

  /**
   * Check if a provider is enabled
   * @param {string} providerName - Name of the OAuth provider
   * @returns {boolean} True if provider is enabled
   */
  isProviderEnabled(providerName) {
    const config = this.providers.get(providerName);
    return !!(config && config.enabled !== false);
  }

  /**
   * Get all supported provider names
   * @returns {Array<string>} Array of all supported provider names
   */
  getSupportedProviders() {
    return [...this.supportedProviders];
  }

  /**
   * Reload configurations (for hot-reloading support)
   * This method can be called when environment variables change
   */
  reloadConfigurations() {
    logger.info('Reloading OAuth provider configurations...');
    const previousProviders = new Set(this.getEnabledProviders());
    
    this.loadConfigurations();
    
    const currentProviders = new Set(this.getEnabledProviders());
    
    // Log changes
    const added = [...currentProviders].filter(p => !previousProviders.has(p));
    const removed = [...previousProviders].filter(p => !currentProviders.has(p));
    
    if (added.length > 0) {
      logger.info(`OAuth providers enabled: ${added.join(', ')}`);
    }
    
    if (removed.length > 0) {
      logger.info(`OAuth providers disabled: ${removed.join(', ')}`);
    }
    
    return {
      enabled: [...currentProviders],
      added,
      removed
    };
  }

  /**
   * Get configuration summary for debugging
   * @returns {Object} Configuration summary (without sensitive data)
   */
  getConfigSummary() {
    const summary = {
      supportedProviders: this.supportedProviders,
      enabledProviders: this.getEnabledProviders(),
      configurations: {}
    };

    for (const [providerName, config] of this.providers) {
      summary.configurations[providerName] = {
        enabled: config.enabled,
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        callbackURL: config.callbackURL,
        scope: config.scope || 'default'
      };
    }

    return summary;
  }
}

module.exports = OAuthConfigManager;