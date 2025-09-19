const FacebookStrategy = require('passport-facebook').Strategy;
const BaseOAuthProvider = require('./BaseOAuthProvider');
const { OAuthAuthenticationError, OAuthConfigurationError } = require('../utils/OAuthError');
const logger = require('../../utils/logger');

/**
 * Facebook OAuth Provider implementation
 * Handles Facebook OAuth 2.0 authentication using passport-facebook
 */
class FacebookOAuthProvider extends BaseOAuthProvider {
  /**
   * Create a new Facebook OAuth provider instance
   * @param {string} providerName - Name of the OAuth provider (should be 'facebook')
   * @param {Object} config - Facebook OAuth configuration
   */
  constructor(providerName, config) {
    super(providerName, config);
  }

  /**
   * Validate Facebook-specific configuration
   * @throws {OAuthConfigurationError} If configuration is invalid
   */
  validateConfig() {
    super.validateConfig();

    // Validate Facebook-specific configuration
    if (!this.config.scope) {
      this.config.scope = 'email'; // Default scope
    }

    // Ensure scope includes required permissions
    const scopes = Array.isArray(this.config.scope) 
      ? this.config.scope 
      : this.config.scope.split(',').map(s => s.trim());

    if (!scopes.includes('email')) {
      throw new OAuthConfigurationError('facebook', 'Facebook OAuth requires "email" scope');
    }

    // Set default profile fields if not specified
    if (!this.config.profileFields) {
      this.config.profileFields = ['id', 'emails', 'name', 'displayName', 'picture.type(large)'];
    }

    logger.debug('Facebook OAuth configuration validated successfully', {
      clientId: this.config.clientId.substring(0, 10) + '...',
      callbackURL: this.config.callbackURL,
      scope: this.config.scope,
      profileFields: this.config.profileFields
    });
  }

  /**
   * Get the Facebook OAuth Passport strategy
   * @returns {FacebookStrategy} Configured Facebook OAuth strategy
   */
  getStrategy() {
    try {
      const strategyConfig = {
        clientID: this.config.clientId,
        clientSecret: this.config.clientSecret,
        callbackURL: this.config.callbackURL,
        scope: this.config.scope,
        profileFields: this.config.profileFields,
        // Enable state parameter for CSRF protection
        enableProof: true,
        // Set API version
        graphAPIVersion: 'v18.0'
      };

      return new FacebookStrategy(
        strategyConfig,
        async (accessToken, refreshToken, profile, done) => {
          try {
            await this.handleCallback(profile, done, { accessToken, refreshToken });
          } catch (error) {
            logger.error('Facebook OAuth callback error:', error);
            return done(this.handleError(error), null);
          }
        }
      );
    } catch (error) {
      throw new OAuthConfigurationError('facebook', `Failed to create Facebook strategy: ${error.message}`);
    }
  }

  /**
   * Normalize Facebook user profile to standard format
   * @param {Object} profile - Raw Facebook profile from OAuth
   * @returns {Object} Normalized profile object
   */
  normalizeProfile(profile) {
    try {
      if (!profile || !profile.id) {
        throw new OAuthAuthenticationError('facebook', 'Invalid profile data received');
      }

      // Extract email from profile
      let email = null;
      let emailVerified = false;

      if (profile.emails && profile.emails.length > 0) {
        const primaryEmail = profile.emails[0];
        email = primaryEmail.value;
        // Facebook doesn't provide email verification status in OAuth response
        // We'll assume it's verified since Facebook requires email verification
        emailVerified = true;
      }

      // Extract profile photo
      let avatar = null;
      if (profile.photos && profile.photos.length > 0) {
        avatar = profile.photos[0].value;
      }

      // Extract name information
      const displayName = profile.displayName || '';
      const firstName = profile.name?.givenName || '';
      const lastName = profile.name?.familyName || '';

      const normalizedProfile = {
        // Standard fields
        id: profile.id,
        provider: 'facebook',
        email: email,
        emailVerified: emailVerified,
        name: displayName,
        firstName: firstName,
        lastName: lastName,
        avatar: avatar,
        
        // Facebook-specific fields
        facebookId: profile.id,
        locale: profile._json?.locale || null,
        timezone: profile._json?.timezone || null,
        
        // Raw profile for debugging (without sensitive data)
        raw: {
          id: profile.id,
          displayName: profile.displayName,
          name: profile.name,
          emails: profile.emails?.map(e => ({ value: e.value })),
          photos: profile.photos?.map(p => ({ value: p.value })),
          provider: profile.provider,
          profileUrl: profile.profileUrl
        }
      };

      logger.debug('Facebook profile normalized:', {
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
      throw new OAuthAuthenticationError('facebook', `Profile normalization failed: ${error.message}`);
    }
  }

  /**
   * Handle Facebook OAuth callback with additional token information
   * @param {Object} profile - Raw Facebook profile
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
      
      // Facebook doesn't typically provide refresh tokens in OAuth 2.0 flow
      if (tokens.refreshToken) {
        normalizedProfile.refreshToken = tokens.refreshToken;
      }

      logger.info('Facebook OAuth authentication successful', {
        userId: normalizedProfile.id,
        email: normalizedProfile.email,
        hasRefreshToken: !!tokens.refreshToken
      });

      return done(null, normalizedProfile);
    } catch (error) {
      logger.error('Facebook OAuth callback handling failed:', error);
      return done(this.handleError(error), null);
    }
  }

  /**
   * Handle Facebook-specific OAuth errors
   * @param {Error} error - Original error
   * @returns {OAuthError} Processed OAuth error
   */
  handleError(error) {
    // Handle specific Facebook OAuth errors
    if (error.message?.includes('access_denied')) {
      return new OAuthAuthenticationError('facebook', 'User denied access to Facebook account');
    }

    if (error.message?.includes('invalid_client_id')) {
      return new OAuthConfigurationError('facebook', 'Invalid Facebook OAuth client ID');
    }

    if (error.message?.includes('invalid_client_secret')) {
      return new OAuthConfigurationError('facebook', 'Invalid Facebook OAuth client secret');
    }

    if (error.message?.includes('redirect_uri_mismatch')) {
      return new OAuthConfigurationError('facebook', 'Facebook OAuth redirect URI mismatch');
    }

    if (error.message?.includes('invalid_code')) {
      return new OAuthAuthenticationError('facebook', 'Invalid or expired Facebook OAuth code');
    }

    if (error.message?.includes('temporarily_unavailable')) {
      return new OAuthAuthenticationError('facebook', 'Facebook OAuth service temporarily unavailable');
    }

    // Handle Facebook API errors
    if (error.message?.includes('OAuthException')) {
      return new OAuthAuthenticationError('facebook', 'Facebook OAuth API error occurred');
    }

    // Handle network/API errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new OAuthAuthenticationError('facebook', 'Unable to connect to Facebook OAuth service');
    }

    // Default error handling
    return super.handleError(error);
  }

  /**
   * Check if Facebook provider supports a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean} True if feature is supported
   */
  supportsFeature(feature) {
    const supportedFeatures = {
      'pkce': false, // Facebook doesn't support PKCE
      'refresh_token': false, // Facebook doesn't provide refresh tokens in standard OAuth flow
      'email_verification': true, // Facebook requires verified emails
      'profile_photos': true,
      'locale_info': true
    };

    return supportedFeatures[feature] || false;
  }

  /**
   * Get Facebook OAuth scopes
   * @returns {Array<string>} Array of OAuth scopes
   */
  getScopes() {
    const scopes = Array.isArray(this.config.scope) 
      ? this.config.scope 
      : this.config.scope.split(',').map(s => s.trim());
    
    return scopes;
  }

  /**
   * Get Facebook provider display name
   * @returns {string} Display name for UI
   */
  getDisplayName() {
    return 'Facebook';
  }

  /**
   * Get Facebook-specific metadata
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
        authorizationURL: 'https://www.facebook.com/v18.0/dialog/oauth',
        tokenURL: 'https://graph.facebook.com/v18.0/oauth/access_token',
        userInfoURL: 'https://graph.facebook.com/v18.0/me'
      }
    };
  }
}

module.exports = FacebookOAuthProvider;