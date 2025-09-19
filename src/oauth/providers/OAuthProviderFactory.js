const logger = require('../../utils/logger');
const BaseOAuthProvider = require('./BaseOAuthProvider');

/**
 * Factory for creating and managing OAuth provider instances
 * Handles dynamic provider instantiation and lifecycle management
 */
class OAuthProviderFactory {
  constructor(configManager) {
    this.configManager = configManager;
    this.providers = new Map();
    this.providerClasses = new Map();
    this.registeredStrategies = new Set();
    
    // Register built-in provider classes
    this.registerBuiltInProviders();
  }

  /**
   * Register built-in OAuth provider classes
   * This method will be expanded as new providers are implemented
   */
  registerBuiltInProviders() {
    // Register implemented provider classes
    this.registerProviderClass('google', require('./GoogleOAuthProvider'));
    // this.registerProviderClass('facebook', require('./FacebookOAuthProvider'));
    
    logger.debug('Built-in OAuth provider classes registered');
  }

  /**
   * Register a provider class for a specific provider name
   * @param {string} providerName - Name of the OAuth provider
   * @param {Class} ProviderClass - Provider class that extends BaseOAuthProvider
   */
  registerProviderClass(providerName, ProviderClass) {
    // Validate that the provider class extends BaseOAuthProvider
    if (!ProviderClass.prototype instanceof BaseOAuthProvider) {
      throw new Error(`Provider class for ${providerName} must extend BaseOAuthProvider`);
    }

    this.providerClasses.set(providerName, ProviderClass);
    logger.debug(`Registered provider class for ${providerName}`);

    // Don't create providers during registration - wait for explicit initialization
  }

  /**
   * Create a provider instance for the specified provider name
   * @param {string} providerName - Name of the OAuth provider
   * @returns {BaseOAuthProvider|null} Provider instance or null if not available
   */
  createProvider(providerName) {
    try {
      // Check if provider is enabled in configuration
      if (!this.configManager.isProviderEnabled(providerName)) {
        logger.debug(`Provider ${providerName} is not enabled`);
        return null;
      }

      // Check if provider class is registered
      const ProviderClass = this.providerClasses.get(providerName);
      if (!ProviderClass) {
        logger.warn(`No provider class registered for ${providerName}`);
        return null;
      }

      // Get provider configuration
      const config = this.configManager.getProviderConfig(providerName);
      if (!config) {
        logger.warn(`No configuration found for provider ${providerName}`);
        return null;
      }

      // Create provider instance
      const provider = new ProviderClass(providerName, config);
      
      // Initialize the provider
      provider.initialize();

      // Store the provider instance
      this.providers.set(providerName, provider);

      logger.info(`Created and initialized ${providerName} OAuth provider`);
      return provider;

    } catch (error) {
      logger.error(`Failed to create provider ${providerName}:`, error);
      return null;
    }
  }

  /**
   * Get a provider instance by name
   * @param {string} providerName - Name of the OAuth provider
   * @returns {BaseOAuthProvider|null} Provider instance or null if not available
   */
  getProvider(providerName) {
    return this.providers.get(providerName) || null;
  }

  /**
   * Get all available provider instances
   * @returns {Map<string, BaseOAuthProvider>} Map of provider name to provider instance
   */
  getAllProviders() {
    return new Map(this.providers);
  }

  /**
   * Get list of available provider names
   * @returns {Array<string>} Array of available provider names
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get list of registered provider class names
   * @returns {Array<string>} Array of registered provider class names
   */
  getRegisteredProviderClasses() {
    return Array.from(this.providerClasses.keys());
  }

  /**
   * Initialize all enabled providers
   * This method should be called during application startup
   * @returns {Array<string>} Array of successfully initialized provider names
   */
  initializeEnabledProviders() {
    const enabledProviders = this.configManager.getEnabledProviders();
    const initializedProviders = [];

    logger.info(`Initializing ${enabledProviders.length} enabled OAuth providers...`);

    for (const providerName of enabledProviders) {
      const provider = this.createProvider(providerName);
      if (provider) {
        initializedProviders.push(providerName);
      }
    }

    logger.info(`Successfully initialized ${initializedProviders.length} OAuth providers: ${initializedProviders.join(', ')}`);
    return initializedProviders;
  }

  /**
   * Reinitialize providers after configuration changes
   * This method supports hot-reloading of provider configurations
   * @returns {Object} Summary of changes made
   */
  reinitializeProviders() {
    logger.info('Reinitializing OAuth providers after configuration change...');

    // Get current state
    const previousProviders = new Set(this.getAvailableProviders());
    
    // Reload configuration
    const configChanges = this.configManager.reloadConfigurations();
    
    // Destroy providers that are no longer enabled
    for (const providerName of configChanges.removed) {
      this.destroyProvider(providerName);
    }

    // Create providers that are newly enabled
    const newlyInitialized = [];
    for (const providerName of configChanges.added) {
      const provider = this.createProvider(providerName);
      if (provider) {
        newlyInitialized.push(providerName);
      }
    }

    // Reinitialize existing providers that might have config changes
    const reinitialized = [];
    for (const providerName of this.getAvailableProviders()) {
      if (!configChanges.added.includes(providerName)) {
        // This provider was already enabled, check if it needs reinitialization
        const provider = this.getProvider(providerName);
        if (provider) {
          try {
            provider.destroy();
            provider.initialize();
            reinitialized.push(providerName);
          } catch (error) {
            logger.error(`Failed to reinitialize provider ${providerName}:`, error);
            this.destroyProvider(providerName);
          }
        }
      }
    }

    const summary = {
      ...configChanges,
      newlyInitialized,
      reinitialized,
      currentProviders: this.getAvailableProviders()
    };

    logger.info('OAuth provider reinitialization complete:', summary);
    return summary;
  }

  /**
   * Destroy a provider instance
   * @param {string} providerName - Name of the OAuth provider to destroy
   */
  destroyProvider(providerName) {
    const provider = this.providers.get(providerName);
    if (provider) {
      try {
        provider.destroy();
        this.providers.delete(providerName);
        logger.info(`Destroyed ${providerName} OAuth provider`);
      } catch (error) {
        logger.error(`Error destroying provider ${providerName}:`, error);
      }
    }
  }

  /**
   * Destroy all provider instances
   * This method should be called during application shutdown
   */
  destroyAllProviders() {
    logger.info('Destroying all OAuth providers...');
    
    for (const providerName of this.providers.keys()) {
      this.destroyProvider(providerName);
    }

    this.registeredStrategies.clear();
    logger.info('All OAuth providers destroyed');
  }

  /**
   * Register a Passport strategy for a provider
   * @param {string} providerName - Name of the OAuth provider
   * @param {Strategy} strategy - Passport strategy instance
   */
  registerStrategy(providerName, strategy) {
    const passport = require('passport');
    
    try {
      // Use provider name as strategy name
      passport.use(providerName, strategy);
      this.registeredStrategies.add(providerName);
      logger.debug(`Registered Passport strategy for ${providerName}`);
    } catch (error) {
      logger.error(`Failed to register Passport strategy for ${providerName}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a Passport strategy for a provider
   * @param {string} providerName - Name of the OAuth provider
   */
  unregisterStrategy(providerName) {
    const passport = require('passport');
    
    try {
      if (this.registeredStrategies.has(providerName)) {
        passport.unuse(providerName);
        this.registeredStrategies.delete(providerName);
        logger.debug(`Unregistered Passport strategy for ${providerName}`);
      }
    } catch (error) {
      logger.error(`Failed to unregister Passport strategy for ${providerName}:`, error);
    }
  }

  /**
   * Register all provider strategies with Passport
   * This method should be called after initializing providers
   */
  registerAllStrategies() {
    logger.info('Registering OAuth strategies with Passport...');
    
    let registeredCount = 0;
    for (const [providerName, provider] of this.providers) {
      try {
        const strategy = provider.getStrategy();
        if (strategy) {
          this.registerStrategy(providerName, strategy);
          registeredCount++;
        }
      } catch (error) {
        logger.error(`Failed to register strategy for ${providerName}:`, error);
      }
    }

    logger.info(`Registered ${registeredCount} OAuth strategies with Passport`);
    return registeredCount;
  }

  /**
   * Get factory status and statistics
   * @returns {Object} Factory status information
   */
  getStatus() {
    const providers = Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      metadata: provider.getMetadata()
    }));

    return {
      totalProviders: this.providers.size,
      registeredClasses: this.providerClasses.size,
      registeredStrategies: this.registeredStrategies.size,
      enabledProviders: this.configManager.getEnabledProviders(),
      providers,
      configSummary: this.configManager.getConfigSummary()
    };
  }

  /**
   * Validate that all enabled providers have registered classes
   * @returns {Object} Validation results
   */
  validateProviders() {
    const enabledProviders = this.configManager.getEnabledProviders();
    const registeredClasses = this.getRegisteredProviderClasses();
    
    const missing = enabledProviders.filter(provider => !registeredClasses.includes(provider));
    const available = enabledProviders.filter(provider => registeredClasses.includes(provider));
    
    const validation = {
      valid: missing.length === 0,
      enabledProviders,
      registeredClasses,
      availableProviders: available,
      missingProviders: missing
    };

    if (missing.length > 0) {
      logger.warn(`Missing provider classes for enabled providers: ${missing.join(', ')}`);
    }

    return validation;
  }
}

module.exports = OAuthProviderFactory;