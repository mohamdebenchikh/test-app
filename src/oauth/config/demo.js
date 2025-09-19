/**
 * Demo script to show OAuthConfigManager with simulated environment variables
 */

const { OAuthConfigManager } = require('./index');

// Simulate environment variables
const originalEnv = { ...process.env };

// Set up test environment variables
process.env.GOOGLE_CLIENT_ID = 'demo-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'demo-google-client-secret';
process.env.FACEBOOK_CLIENT_ID = 'demo-facebook-app-id';
process.env.FACEBOOK_CLIENT_SECRET = 'demo-facebook-app-secret';
process.env.BASE_URL = 'https://myapp.com';

console.log('OAuth Configuration Manager Demo');
console.log('================================\n');

// Initialize configuration manager
const configManager = new OAuthConfigManager();

// Show configuration summary
const summary = configManager.getConfigSummary();
console.log('Configuration Summary:');
console.log(`- Supported providers: ${summary.supportedProviders.join(', ')}`);
console.log(`- Enabled providers: ${summary.enabledProviders.join(', ')}\n`);

// Show detailed configuration for enabled providers
summary.enabledProviders.forEach(provider => {
  const config = summary.configurations[provider];
  console.log(`${provider.toUpperCase()} Configuration:`);
  console.log(`  ✓ Enabled: ${config.enabled}`);
  console.log(`  ✓ Has credentials: ${config.hasClientId && config.hasClientSecret}`);
  console.log(`  ✓ Callback URL: ${config.callbackURL}`);
  console.log(`  ✓ Scope: ${config.scope}`);
  console.log('');
});

// Demonstrate provider checking
console.log('Provider Status Check:');
['google', 'facebook', 'github', 'twitter'].forEach(provider => {
  const isEnabled = configManager.isProviderEnabled(provider);
  const status = isEnabled ? '✓ ENABLED' : '✗ DISABLED';
  console.log(`  ${provider.padEnd(10)} ${status}`);
});

console.log('\nDemonstrating hot-reload...');

// Add GitHub configuration
process.env.GITHUB_CLIENT_ID = 'demo-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'demo-github-client-secret';

const reloadResult = configManager.reloadConfigurations();
console.log(`Added providers: ${reloadResult.added.join(', ') || 'none'}`);
console.log(`Current enabled providers: ${reloadResult.enabled.join(', ')}`);

// Remove Facebook configuration
delete process.env.FACEBOOK_CLIENT_ID;
delete process.env.FACEBOOK_CLIENT_SECRET;

const reloadResult2 = configManager.reloadConfigurations();
console.log(`Removed providers: ${reloadResult2.removed.join(', ') || 'none'}`);
console.log(`Current enabled providers: ${reloadResult2.enabled.join(', ')}`);

// Restore original environment
process.env = originalEnv;

console.log('\nDemo completed successfully! ✓');