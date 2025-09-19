// OAuth utilities
// This file exports OAuth-related utility functions

const {
  OAuthError,
  ProviderNotEnabledError,
  OAuthConfigurationError,
  AccountLinkingError,
  OAuthAuthenticationError,
} = require('./OAuthError');

module.exports = {
  OAuthError,
  ProviderNotEnabledError,
  OAuthConfigurationError,
  AccountLinkingError,
  OAuthAuthenticationError,
};