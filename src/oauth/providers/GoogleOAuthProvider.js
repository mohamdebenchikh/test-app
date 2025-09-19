const GoogleStrategy = require('passport-google-oauth20').Strategy;
const BaseOAuthProvider = require('./BaseOAuthProvider');
const { OAuthAuthenticationError, OAuthConfigurationError } = require('../utils/OAuthError');
const logger = require('../../utils/logger');

/**
 * Google OAuth Provider implementation
 * Handles Google OAuth 2.0 authentication using passport-google-oauth20
 */
class GoogleOAuthProvider extends BaseOAuthProvider {
  /**
   * Create a new Google OAuth provider instance
   * @param {string} providerName - Name of the OAuth provider (should be 'google')
   * @param {Object} config - Google OAuth configuration
   */
  constructor(providerName, config) {
    super(providerName, config);
  }

  /**
   * Validate Google-specific configuration
   * @throws {OAuthConfigurationError} If configuration is invalid
   */
  validateConfig() {
    super.validateConfig();

    // Validate Google-specific configuration
    if (!this.config.scope) {
      this.config.scope = 'profile email'; // Default scope
    }

    // Ensure scope includes required permissions
    const scopes = Array.isArray(this.config.scope) 
      ? this.config.scope 
      : this.config.scope.split(' ');

    if (!scopes.includes('profile')) {
      throw new OAuthConfigurationError('google', 'Google OAuth requires "profile" scope');
    }

    if (!scopes.includes('email')) {
      throw new OAuthConfigurationError('google', 'Google OAuth requires "email" scope');
    }

    logger.debug('Google OAuth configuration validated successfully', {
      clientId: this.config.clientId.substring(0, 10) + '...',
      callbackURL: this.config.callbackURL,
      scope: this.config.scope
    });
  }

  /**
   * Get the Google OAuth Passport strategy
   * @returns {GoogleStrategy} Configured Google OAuth strategy
   */
  getStrategy() {
    try {
      const strategyConfig = {
        clientID: this.config.clientId,
        clientSecret: this.config.clientSecret,
        callbackURL: this.config.callbackURL,
        scope: this.config.scope,
        // Enable PKCE for enhanced security
        pkce: true,
        state: true, // Required when PKCE is enabled
        // Request additional user info
        userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
      };

      return new GoogleStrategy(
        strategyConfig,
        async (accessToken, refreshToken, profile, done) => {
          try {
            await this.handleCallback(profile, done, { accessToken, refreshToken });
          } catch (error) {
            logger.error('Google OAuth callback error:', error);
            return done(this.handleError(error), null);
          }
        }
      );
    } catch (error) {
      throw new OAuthConfigurationError('google', `Failed to create Google strategy: ${error.message}`);
    }
  }

  /**
   * Normalize Google user profile to standard format
   * @param {Object} profile - Raw Google profile from OAuth
   * @returns {Object} Normalized profile object
   */
  normalizeProfile(profile) {
    try {
      if (!profile || !profile.id) {
        throw new OAuthAuthenticationError('google', 'Invalid profile data received');
      }

      // Extract email from profile
      let email = null;
      let emailVerified = false;

      if (profile.emails && profile.emails.length > 0) {
        const primaryEmail = profile.emails.find(e => e.type === 'account') || profile.emails[0];
        email = primaryEmail.value;
        emailVerified = primaryEmail.verified !== false; // Default to true if not specified
      }

      // Extract profile photo
      let avatar = null;
      if (profile.photos && profile.photos.length > 0) {
        avatar = profile.photos[0].value;
        // Remove size parameter to get higher resolution image
        if (avatar && avatar.includes('?sz=')) {
          avatar = avatar.split('?sz=')[0] + '?sz=200';
        }
      }

      // Extract name information
      const displayName = profile.displayName || '';
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';

      const normalizedProfile = {
        // Standard fields
        id: profile.id,
        provider: 'google',
        email: email,
        emailVerified: emailVerified,
        name: displayName,
        firstName: firstName,
        lastName: lastName,
        avatar: avatar,
        
        // Google-specific fields
        googleId: profile.id,
        locale: profile._json?.locale || null,
        timezone: profile._json?.timezone || null,
        
        // Raw profile for debugging (without sensitive data)
        raw: {
          id: profile.id,
          displayName: profile.displayName,
          name: profile.name,
          emails: profile.emails?.map(e => ({ value: e.value, verified: e.verified })),
          photos: profile.photos?.map(p => ({ value: p.value })),
          provider: profile.provider
        }
      };

      logger.debug('Google profile normalized:', {
        id: normalizedProfile.id,
        email: normalizedProfile.email,
        name: normalizedProfile.name,
        emailVerified: normalizedProfile.emailVerified
      });

      return normalizedProfile;
    } catch (error) {
      if (error instanceof OAuthAuthenticationError) {
        throw error;
      }
      throw new OAuthAuthenticationError('google', `Profile normalization failed: ${error.message}`);
    }
  }

  /**
   * Handle Google OAuth callback with additional token information
   * @param {Object} profile - Raw Google profile
   * @param {Function} done - Passport done callback
   * @param {Object} tokens - Access and refresh tokens
   */
  async handleCallback(profile, done, tokens = {}) {
    try {
      const normalizedProfile = this.normalizeProfile(profile);
      
      // Add token information if available
      if (tokens.accessToken) {
        normalizedProfile.accessToken = tokens.accessToken;
      }
      
      if (tokens.refreshToken) {
        normalizedProfile.refreshToken = tokens.refreshToken;
      }

      logger.info('Google OAuth authentication successful', {
        userId: normalizedProfile.id,
        email: normalizedProfile.email,
        hasRefreshToken: !!tokens.refreshToken
      });

      return done(null, normalizedProfile);
    } catch (error) {
      logger.error('Google OAuth callback handling failed:', error);
      return done(this.handleError(error), null);
    }
  }

  /**
   * Handle Google-specific OAuth errors
   * @param {Error} error - Original error
   * @returns {OAuthError} Processed OAuth error
   */
  handleError(error) {
    // Handle specific Google OAuth errors
    if (error.message?.includes('access_denied')) {
      return new OAuthAuthenticationError('google', 'User denied access to Google account');
    }

    if (error.message?.includes('invalid_client')) {
      return new OAuthConfigurationError('google', 'Invalid Google OAuth client configuration');
    }

    if (error.message?.includes('invalid_grant')) {
      return new OAuthAuthenticationError('google', 'Invalid or expired Google OAuth grant');
    }

    if (error.message?.includes('insufficient_permissions')) {
      return new OAuthAuthenticationError('google', 'Insufficient permissions granted by user');
    }

    // Handle network/API errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new OAuthAuthenticationError('google', 'Unable to connect to Google OAuth service');
    }

    // Default error handling
    return super.handleError(error);
  }

  /**
   * Check if Google provider supports a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean} True if feature is supported
   */
  supportsFeature(feature) {
    const supportedFeatures = {
      'pkce': true,
      'refresh_token': true,
      'email_verification': true,
      'profile_photos': true,
      'locale_info': true
    };

    return supportedFeatures[feature] || false;
  }

  /**
   * Get Google OAuth scopes
   * @returns {Array<string>} Array of OAuth scopes
   */
  getScopes() {
    const scopes = Array.isArray(this.config.scope) 
      ? this.config.scope 
      : this.config.scope.split(' ');
    
    return scopes;
  }

  /**
   * Get Google provider display name
   * @returns {string} Display name for UI
   */
  getDisplayName() {
    return 'Google';
  }

  /**
   * Get Google-specific metadata
   * @returns {Object} Provider metadata
   */
  getMetadata() {
    const baseMetadata = super.getMetadata();
    
    return {
      ...baseMetadata,
      features: {
        ...baseMetadata.features,
        pkce: this.supportsFeature('pkce'),
        refreshToken: this.supportsFeature('refresh_token'),
        emailVerification: this.supportsFeature('email_verification'),
        profilePhotos: this.supportsFeature('profile_photos'),
        localeInfo: this.supportsFeature('locale_info')
      },
      oauth: {
        version: '2.0',
        authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenURL: 'https://www.googleapis.com/oauth2/v4/token',
        userInfoURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
      }
    };
  }
}

module.exports = GoogleOAuthProvider;