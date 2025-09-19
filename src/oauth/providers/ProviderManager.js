const logger = require('../../utils/logger');
const OAuthConfigManager = require('../config/OAuthConfigManager');
const OAuthProviderFactory = require('./OAuthProviderFactory');

/**
 * Provider Manager - High-level interface for OAuth provider management
 * Coordinates between configuration management and provider factory
 */
class ProviderManager {
  constructor() {
    this.configManager = new OAuthConfigManager();
    this.providerFactory = new OAuthProviderFactory(this.configManager);
    this.initialized = false;
  }

  /**
   * Initialize the provider manager
   * This should be called during application startup
   * @returns {Promise<Object>} Initialization results
   */
  async initialize() {
    try {
      logger.info('Initializing OAuth Provider Manager...');

      // Validate provider configurations
      const validation = this.providerFactory.validateProviders();
      if (!validation.valid) {
        logger.warn('Some enabled providers are missing implementations:', validation.missingProviders);
      }

      // Initialize enabled providers
      const initializedProviders = this.providerFactory.initializeEnabledProviders();

      // Register strategies with Passport
      const registeredStrategies = this.providerFactory.registerAllStrategies();

      this.initialized = true;

      const result = {
        success: true,
        initializedProviders,
        registeredStrategies,
        validation,
        status: this.getStatus()
      };

      logger.info('OAuth Provider Manager initialized successfully:', {
        providers: initializedProviders.length,
        strategies: registeredStrategies
      });

      return result;

    } catch (error) {
      logger.error('Failed to initialize OAuth Provider Manager:', error);
      throw error;
    }
  }

  /**
   * Reload provider configurations and reinitialize providers
   * Supports hot-reloading of OAuth provider settings
   * @returns {Promise<Object>} Reload results
   */
  async reload() {
    try {
      logger.info('Reloading OAuth Provider Manager...');

      if (!this.initialized) {
        return await this.initialize();
      }

      // Reinitialize providers with new configuration
      const changes = this.providerFactory.reinitializeProviders();

      // Re-register strategies
      const registeredStrategies = this.providerFactory.registerAllStrategies();

      const result = {
        success: true,
        changes,
        registeredStrategies,
        status: this.getStatus()
      };

      logger.info('OAuth Provider Manager reloaded successfully');
      return result;

    } catch (error) {
      logger.error('Failed to reload OAuth Provider Manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the provider manager
   * This should be called during application shutdown
   */
  async shutdown() {
    try {
      logger.info('Shutting down OAuth Provider Manager...');

      // Destroy all providers
      this.providerFactory.destroyAllProviders();

      this.initialized = false;
      logger.info('OAuth Provider Manager shut down successfully');

    } catch (error) {
      logger.error('Error during OAuth Provider Manager shutdown:', error);
      throw error;
    }
  }

  /**
   * Register a new provider class
   * @param {string} providerName - Name of the OAuth provider
   * @param {Class} ProviderClass - Provider class that extends BaseOAuthProvider
   */
  registerProvider(providerName, ProviderClass) {
    this.providerFactory.registerProviderClass(providerName, ProviderClass);
    
    // If already initialized, try to create the provider instance
    if (this.initialized && this.configManager.isProviderEnabled(providerName)) {
      const provider = this.providerFactory.createProvider(providerName);
      if (provider) {
        const strategy = provider.getStrategy();
        if (strategy) {
          this.providerFactory.registerStrategy(providerName, strategy);
        }
      }
    }
  }

  /**
   * Get a provider instance by name
   * @param {string} providerName - Name of the OAuth provider
   * @returns {BaseOAuthProvider|null} Provider instance or null if not available
   */
  getProvider(providerName) {
    return this.providerFactory.getProvider(providerName);
  }

  /**
   * Get all available providers
   * @returns {Array<string>} Array of available provider names
   */
  getAvailableProviders() {
    return this.providerFactory.getAvailableProviders();
  }

  /**
   * Get enabled providers from configuration
   * @returns {Array<string>} Array of enabled provider names
   */
  getEnabledProviders() {
    return this.configManager.getEnabledProviders();
  }

  /**
   * Check if a provider is available and ready
   * @param {string} providerName - Name of the OAuth provider
   * @returns {boolean} True if provider is available
   */
  isProviderAvailable(providerName) {
    const provider = this.getProvider(providerName);
    return provider && provider.strategy;
  }

  /**
   * Get provider configuration (safe, without secrets)
   * @param {string} providerName - Name of the OAuth provider
   * @returns {Object|null} Safe provider configuration
   */
  getProviderConfig(providerName) {
    const provider = this.getProvider(providerName);
    return provider ? provider.getSafeConfig() : null;
  }

  /**
   * Get comprehensive status of the provider manager
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      configManager: this.configManager.getConfigSummary(),
      providerFactory: this.providerFactory.getStatus(),
      validation: this.providerFactory.validateProviders()
    };
  }

  /**
   * Get provider metadata for a specific provider
   * @param {string} providerName - Name of the OAuth provider
   * @returns {Object|null} Provider metadata
   */
  getProviderMetadata(providerName) {
    const provider = this.getProvider(providerName);
    return provider ? provider.getMetadata() : null;
  }

  /**
   * Get all provider metadata
   * @returns {Array<Object>} Array of provider metadata objects
   */
  getAllProviderMetadata() {
    return this.getAvailableProviders().map(providerName => ({
      name: providerName,
      ...this.getProviderMetadata(providerName)
    }));
  }

  /**
   * Health check for the provider manager
   * @returns {Object} Health check results
   */
  healthCheck() {
    const status = this.getStatus();
    const enabledCount = status.configManager.enabledProviders.length;
    const availableCount = status.providerFactory.totalProviders;
    const strategiesCount = status.providerFactory.registeredStrategies;

    return {
      healthy: this.initialized && enabledCount === availableCount && availableCount === strategiesCount,
      initialized: this.initialized,
      providers: {
        enabled: enabledCount,
        available: availableCount,
        strategies: strategiesCount
      },
      issues: status.validation.missingProviders.length > 0 ? 
        [`Missing implementations: ${status.validation.missingProviders.join(', ')}`] : []
    };
  }
}

// Export singleton instance
module.exports = ProviderManager;