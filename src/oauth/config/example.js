/**
 * Example usage of OAuthConfigManager
 * This file demonstrates how to use the OAuth configuration management system
 */

const { OAuthConfigManager } = require('./index');

// Example: Initialize OAuth configuration manager
function initializeOAuthConfig() {
  const configManager = new OAuthConfigManager();
  
  console.log('OAuth Configuration Summary:');
  console.log('============================');
  
  const summary = configManager.getConfigSummary();
  console.log(`Supported providers: ${summary.supportedProviders.join(', ')}`);
  console.log(`Enabled providers: ${summary.enabledProviders.join(', ')}`);
  
  if (summary.enabledProviders.length === 0) {
    console.log('\nNo OAuth providers are currently enabled.');
    console.log('To enable providers, set the following environment variables:');
    console.log('');
    console.log('For Google OAuth:');
    console.log('  GOOGLE_CLIENT_ID=your_google_client_id');
    console.log('  GOOGLE_CLIENT_SECRET=your_google_client_secret');
    console.log('');
    console.log('For Facebook OAuth:');
    console.log('  FACEBOOK_CLIENT_ID=your_facebook_app_id');
    console.log('  FACEBOOK_CLIENT_SECRET=your_facebook_app_secret');
    console.log('');
    console.log('For GitHub OAuth:');
    console.log('  GITHUB_CLIENT_ID=your_github_client_id');
    console.log('  GITHUB_CLIENT_SECRET=your_github_client_secret');
    console.log('');
    console.log('For Twitter OAuth:');
    console.log('  TWITTER_CLIENT_ID=your_twitter_consumer_key');
    console.log('  TWITTER_CLIENT_SECRET=your_twitter_consumer_secret');
  } else {
    console.log('\nProvider configurations:');
    summary.enabledProviders.forEach(provider => {
      const config = summary.configurations[provider];
      console.log(`\n${provider.toUpperCase()}:`);
      console.log(`  - Enabled: ${config.enabled}`);
      console.log(`  - Has credentials: ${config.hasClientId && config.hasClientSecret}`);
      console.log(`  - Callback URL: ${config.callbackURL}`);
      console.log(`  - Scope: ${config.scope}`);
    });
  }
  
  return configManager;
}

// Example: Hot-reload configuration
function demonstrateHotReload(configManager) {
  console.log('\n\nDemonstrating hot-reload functionality:');
  console.log('=====================================');
  
  const result = configManager.reloadConfigurations();
  
  console.log(`Currently enabled: ${result.enabled.join(', ')}`);
  if (result.added.length > 0) {
    console.log(`Newly enabled: ${result.added.join(', ')}`);
  }
  if (result.removed.length > 0) {
    console.log(`Disabled: ${result.removed.join(', ')}`);
  }
}

// Example: Check specific provider
function checkProvider(configManager, providerName) {
  console.log(`\n\nChecking ${providerName} provider:`);
  console.log('='.repeat(20 + providerName.length));
  
  if (configManager.isProviderEnabled(providerName)) {
    const config = configManager.getProviderConfig(providerName);
    console.log(`✓ ${providerName} is enabled`);
    console.log(`  Callback URL: ${config.callbackURL}`);
    console.log(`  Scope: ${config.scope || 'default'}`);
  } else {
    console.log(`✗ ${providerName} is not enabled`);
    console.log(`  Missing environment variables:`);
    console.log(`    ${providerName.toUpperCase()}_CLIENT_ID`);
    console.log(`    ${providerName.toUpperCase()}_CLIENT_SECRET`);
  }
}

// Export example functions for use in other files
module.exports = {
  initializeOAuthConfig,
  demonstrateHotReload,
  checkProvider,
};

// If this file is run directly, execute the examples
if (require.main === module) {
  const configManager = initializeOAuthConfig();
  demonstrateHotReload(configManager);
  
  // Check each supported provider
  const supportedProviders = configManager.getSupportedProviders();
  supportedProviders.forEach(provider => {
    checkProvider(configManager, provider);
  });
}