// OAuth providers index file
// This file exports all OAuth provider implementations and factory

const BaseOAuthProvider = require('./BaseOAuthProvider');
const OAuthProviderFactory = require('./OAuthProviderFactory');
const ProviderManager = require('./ProviderManager');

module.exports = {
  // Core provider infrastructure
  BaseOAuthProvider,
  OAuthProviderFactory,
  ProviderManager,
  
  // Provider implementations
  GoogleOAuthProvider: require('./GoogleOAuthProvider'),
};