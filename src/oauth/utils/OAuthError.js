const ApiError = require('../../utils/ApiError');

/**
 * Base OAuth Error class
 */
class OAuthError extends ApiError {
  constructor(provider, originalError, statusCode = 400) {
    const message = originalError instanceof Error 
      ? originalError.message 
      : String(originalError);
    
    super(statusCode, `OAuth ${provider} error: ${message}`);
    this.provider = provider;
    this.originalError = originalError;
    this.name = 'OAuthError';
  }
}

/**
 * Error thrown when a provider is not enabled
 */
class ProviderNotEnabledError extends OAuthError {
  constructor(provider) {
    super(provider, new Error('Provider not enabled'), 400);
    this.name = 'ProviderNotEnabledError';
  }
}

/**
 * Error thrown when OAuth configuration is invalid
 */
class OAuthConfigurationError extends OAuthError {
  constructor(provider, reason) {
    super(provider, new Error(`Configuration error: ${reason}`), 500);
    this.name = 'OAuthConfigurationError';
  }
}

/**
 * Error thrown when account linking fails
 */
class AccountLinkingError extends OAuthError {
  constructor(provider, reason) {
    super(provider, new Error(`Account linking failed: ${reason}`), 409);
    this.name = 'AccountLinkingError';
  }
}

/**
 * Error thrown when OAuth provider authentication fails
 */
class OAuthAuthenticationError extends OAuthError {
  constructor(provider, reason) {
    super(provider, new Error(`Authentication failed: ${reason}`), 401);
    this.name = 'OAuthAuthenticationError';
  }
}

module.exports = {
  OAuthError,
  ProviderNotEnabledError,
  OAuthConfigurationError,
  AccountLinkingError,
  OAuthAuthenticationError,
};