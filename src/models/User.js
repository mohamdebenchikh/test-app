/**
 * @fileoverview Defines the User model for Sequelize.
 * @module models/User
 */

const { Op } = require('sequelize');
const { comparePassword } = require('../utils/password');

/**
 * Defines the User model.
 * @param {object} sequelize - The Sequelize instance.
 * @param {object} DataTypes - The Sequelize data types.
 * @returns {object} The User model.
 */

module.exports = (sequelize, DataTypes) => {
  /**
   * @class User
   * @classdesc The User model.
   * @property {string} id - The UUID of the user.
   * @property {string} name - The name of the user.
   * @property {string} email - The email of the user.
   * @property {string} password - The hashed password of the user.
   * @property {string} avatar - The URL of the user's avatar.
   * @property {string} bio - The biography of the user.
   * @property {string} phone_number - The phone number of the user.
   * @property {string} role - The role of the user ('client' or 'provider').
   * @property {string} gender - The gender of the user ('male', 'female', 'other').
   * @property {Date} birthdate - The birthdate of the user.
   * @property {boolean} verify - Whether the user's email is verified.
   * @property {Date} last_seen - The last time the user was active.
   * @property {object} available_days - The days the user is available (for providers).
   * @property {string} language - The preferred language of the user.
   * @property {boolean} active - Whether the user's account is active.
   * @property {string} city_id - The ID of the city the user resides in.
   */
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      bio: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      phone_number: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      role: {
          type: DataTypes.ENUM('client', 'provider'),
          allowNull: false,
      },
      gender: {
          type: DataTypes.ENUM('male', 'female', 'other'),
          allowNull: true,
      },
      birthdate: {
          type: DataTypes.DATE,
          allowNull: true,
      },
      verify: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
      },
      last_seen: {
          type: DataTypes.DATE,
          allowNull: true,
      },
      available_days: {
          type: DataTypes.JSON,
          allowNull: true,
      },
      language: {
          type: DataTypes.ENUM('en', 'ar', 'fr'),
          defaultValue: 'en',
      },
      active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
      },
      city_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      online_status: {
        type: DataTypes.ENUM('online', 'offline', 'away', 'dnd'),
        defaultValue: 'offline',
        allowNull: false,
      },
      last_activity: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      show_online_status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      custom_status_message: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      average_response_time_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Cached average response time in minutes'
      },
      response_rate_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Cached response rate as percentage'
      },
      metrics_last_updated: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When metrics were last calculated'
      },
    },
    {
      timestamps: true,
      tableName: "users",
    }
  );

  /**
   * Check if email is taken
   * @param {string} email - The user's email
   * @param {UUID} [excludeUserId] - The id of the user to be excluded
   * @returns {Promise<boolean>}
   */
  User.isEmailTaken = async function (email, excludeUserId) {
    const user = await this.findOne({ where: { email, id: { [Op.ne]: excludeUserId } } });
    return !!user;
  };

  /**
   * Check if password matches the user's password
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  User.prototype.isPasswordMatch = async function (password) {
    const user = this;
    return comparePassword(password, user.password);
  };

  /**
   * Calculate the average rating for this provider
   * @returns {Promise<string>}
   */
  User.prototype.getAverageRating = async function () {
    const reviews = await sequelize.models.Review.findAll({
      where: { provider_id: this.id },
      attributes: [[sequelize.fn('AVG', sequelize.col('stars')), 'averageRating']]
    });
    
    const avgRating = reviews[0].toJSON().averageRating;
    return avgRating ? parseFloat(avgRating).toFixed(1) : '0';
  };

  /**
   * Get user's presence information with privacy controls
   * @param {string} requestingUserId - The user requesting the presence info
   * @returns {object}
   */
  User.prototype.getPresenceInfo = function (requestingUserId = null) {
    // Avoid circular dependency by implementing logic directly here
    const baseInfo = {
      userId: this.id,
      online_status: 'offline',
      last_seen: null,
      custom_message: null,
      show_status: this.show_online_status
    };

    // If user doesn't allow showing status
    if (!this.show_online_status && this.id !== requestingUserId) {
      return {
        ...baseInfo,
        last_seen_text: 'Last seen recently'
      };
    }

    // If user is in DND mode, show as offline to others
    if (this.online_status === 'dnd' && this.id !== requestingUserId) {
      return {
        ...baseInfo,
        last_seen_text: 'Last seen recently'
      };
    }

    // Return full info for own requests or when privacy allows
    return {
      userId: this.id,
      online_status: this.online_status,
      last_seen: this.last_activity || this.last_seen,
      custom_message: this.custom_status_message,
      show_status: this.show_online_status,
      last_seen_text: this.getLastSeenText(requestingUserId)
    };
  };

  /**
   * Check if user is currently online
   * @returns {boolean}
   */
  User.prototype.isOnline = function () {
    return this.online_status === 'online';
  };

  /**
   * Get human-readable last seen text with privacy controls
   * @param {string} requestingUserId - The user requesting the last seen info
   * @returns {string}
   */
  User.prototype.getLastSeenText = function (requestingUserId = null) {
    // If user doesn't allow showing status and it's not their own request
    if (!this.show_online_status && this.id !== requestingUserId) {
      return 'Last seen recently';
    }

    // If user is in DND mode, show as recently seen to others
    if (this.online_status === 'dnd' && this.id !== requestingUserId) {
      return 'Last seen recently';
    }

    if (this.online_status === 'online') {
      return 'Online now';
    }

    if (this.online_status === 'away') {
      const customMessage = this.custom_status_message;
      return customMessage ? `Away - ${customMessage}` : 'Away';
    }

    if (this.online_status === 'dnd' && this.id === requestingUserId) {
      return 'Do Not Disturb';
    }

    const lastSeen = this.last_activity || this.last_seen;
    if (!lastSeen) {
      return 'Last seen recently';
    }

    // For privacy, don't show exact timestamps to others unless allowed
    if (!this.show_online_status && this.id !== requestingUserId) {
      return 'Last seen recently';
    }

    const now = new Date();
    const diffMs = now - new Date(lastSeen);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Last seen just now';
    } else if (diffMinutes < 60) {
      return `Last seen ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `Last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `Last seen ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return 'Last seen more than a week ago';
    }
  };

  /**
   * Check if user allows showing presence information
   * @returns {boolean}
   */
  User.prototype.canShowPresence = function () {
    return this.show_online_status;
  };

  /**
   * Check if user is a provider
   * @returns {boolean}
   */
  User.prototype.isProvider = function () {
    return this.role === 'provider';
  };

  /**
   * Calculate response metrics for this provider
   * @returns {Promise<object>} Object containing calculated metrics
   */
  User.prototype.calculateResponseMetrics = async function () {
    // Only calculate metrics for providers
    if (!this.isProvider()) {
      return {
        averageResponseTime: null,
        responseRate: null,
        sampleSize: 0,
        hasInsufficientData: true
      };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // Get response metrics from the last 30 days
      const metrics = await sequelize.models.ResponseMetrics.findAll({
        where: {
          provider_id: this.id,
          createdAt: {
            [Op.gte]: thirtyDaysAgo
          }
        },
        order: [['createdAt', 'DESC']]
      });

      const totalMetrics = metrics.length;

      // Handle case with no data
      if (totalMetrics === 0) {
        return {
          averageResponseTime: null,
          responseRate: null,
          sampleSize: 0,
          hasInsufficientData: true
        };
      }

      // Filter out invalid metrics
      const validMetrics = metrics.filter(metric => {
        // Skip metrics with invalid response times
        if (metric.response_time_minutes !== null) {
          if (metric.response_time_minutes < 0) {
            console.warn(`Skipping metric with negative response time: ${metric.id}`);
            return false;
          }
          
          // Skip metrics with excessively large response times (more than 7 days)
          const maxResponseTimeMinutes = 7 * 24 * 60;
          if (metric.response_time_minutes > maxResponseTimeMinutes) {
            console.warn(`Skipping metric with excessive response time: ${metric.id} (${metric.response_time_minutes} minutes)`);
            return false;
          }
        }
        
        return true;
      });

      const validMetricsCount = validMetrics.length;

      // Handle case where all metrics were invalid
      if (validMetricsCount === 0) {
        return {
          averageResponseTime: null,
          responseRate: null,
          sampleSize: 0,
          hasInsufficientData: true
        };
      }

      // Calculate response rate (percentage of messages responded to within 24h)
      const respondedCount = validMetrics.filter(metric => metric.responded_within_24h).length;
      let responseRate = validMetricsCount > 0 ? (respondedCount / validMetricsCount) * 100 : 0;
      
      // Ensure response rate is within valid bounds
      if (responseRate < 0) {
        responseRate = 0;
      } else if (responseRate > 100) {
        responseRate = 100;
      }

      // Calculate average response time (only for messages that were responded to and are valid)
      const respondedMetrics = validMetrics.filter(metric => 
        metric.response_time_minutes !== null && metric.response_time_minutes > 0
      );
      
      let averageResponseTime = null;
      if (respondedMetrics.length > 0) {
        const totalResponseTime = respondedMetrics.reduce((sum, metric) => 
          sum + metric.response_time_minutes, 0
        );
        averageResponseTime = Math.round(totalResponseTime / respondedMetrics.length);
        
        // Ensure average is reasonable
        if (averageResponseTime < 0) {
          console.warn(`Calculated negative average response time: ${averageResponseTime}, setting to null`);
          averageResponseTime = null;
        }
      }

      // Check if we have insufficient data (less than 3 conversations)
      const hasInsufficientData = validMetricsCount < 3;

      return {
        averageResponseTime,
        responseRate: Math.round(responseRate * 100) / 100, // Round to 2 decimal places
        sampleSize: validMetricsCount,
        hasInsufficientData
      };

    } catch (error) {
      console.error('Error calculating response metrics:', error);
      return {
        averageResponseTime: null,
        responseRate: null,
        sampleSize: 0,
        hasInsufficientData: true,
        error: error.message
      };
    }
  };

  /**
   * Get formatted response metrics for display
   * @returns {Promise<object>} Formatted metrics for public display
   */
  User.prototype.getResponseMetrics = async function () {
    try {
      const metrics = await this.calculateResponseMetrics();

      // Return null if not a provider or insufficient data
      if (!this.isProvider() || metrics.hasInsufficientData) {
        return {
          averageResponseTime: null,
          responseRate: null,
          displayText: 'No response data available',
          basedOnDays: 30,
          sampleSize: metrics.sampleSize,
          lastUpdated: this.metrics_last_updated,
          error: metrics.error || null
        };
      }

      // Format average response time for human readability
      let formattedResponseTime = null;
      if (metrics.averageResponseTime !== null && metrics.averageResponseTime > 0) {
        const minutes = metrics.averageResponseTime;
        
        // Validate minutes is a reasonable number
        if (minutes > 0 && minutes < (30 * 24 * 60)) { // Less than 30 days
          if (minutes < 60) {
            formattedResponseTime = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            if (remainingMinutes === 0) {
              formattedResponseTime = `${hours} hour${hours !== 1 ? 's' : ''}`;
            } else {
              formattedResponseTime = `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
            }
          }
        } else {
          console.warn(`Invalid average response time: ${minutes} minutes, not formatting`);
        }
      }

      // Format response rate as percentage
      let formattedResponseRate = null;
      if (metrics.responseRate !== null && metrics.responseRate >= 0 && metrics.responseRate <= 100) {
        formattedResponseRate = `${metrics.responseRate}%`;
      } else if (metrics.responseRate !== null) {
        console.warn(`Invalid response rate: ${metrics.responseRate}%, not formatting`);
      }

      return {
        averageResponseTime: formattedResponseTime,
        responseRate: formattedResponseRate,
        basedOnDays: 30,
        sampleSize: metrics.sampleSize,
        lastUpdated: this.metrics_last_updated,
        rawMetrics: {
          averageResponseTimeMinutes: metrics.averageResponseTime,
          responseRatePercentage: metrics.responseRate
        },
        error: metrics.error || null
      };
    } catch (error) {
      console.error('Error getting response metrics:', error);
      return {
        averageResponseTime: null,
        responseRate: null,
        displayText: 'Error loading response data',
        basedOnDays: 30,
        sampleSize: 0,
        lastUpdated: this.metrics_last_updated,
        error: error.message
      };
    }
  };

  /**
   * Get response metrics with privacy controls for public display
   * @returns {Promise<object>} Public response metrics
   */
  User.prototype.getPublicResponseMetrics = async function () {
    try {
      // Only show metrics for providers
      if (!this.isProvider()) {
        return null;
      }

      const metrics = await this.getResponseMetrics();
      
      // Handle error cases gracefully
      if (metrics.error) {
        return {
          displayText: 'Response data temporarily unavailable',
          note: 'Please try again later'
        };
      }
      
      // Don't show metrics if insufficient data
      if (metrics.sampleSize < 3) {
        return {
          displayText: 'No response data available',
          note: 'Metrics will be available after more interactions'
        };
      }

      // Validate metrics before displaying
      const hasValidResponseTime = metrics.averageResponseTime !== null && 
                                   metrics.rawMetrics.averageResponseTimeMinutes > 0;
      const hasValidResponseRate = metrics.responseRate !== null && 
                                   metrics.rawMetrics.responseRatePercentage >= 0 && 
                                   metrics.rawMetrics.responseRatePercentage <= 100;

      // If neither metric is valid, show no data message
      if (!hasValidResponseTime && !hasValidResponseRate) {
        return {
          displayText: 'No response data available',
          note: 'Metrics will be available after more interactions'
        };
      }

      return {
        averageResponseTime: hasValidResponseTime ? metrics.averageResponseTime : null,
        responseRate: hasValidResponseRate ? metrics.responseRate : null,
        basedOnDays: metrics.basedOnDays,
        sampleSize: metrics.sampleSize,
        note: `Based on ${metrics.sampleSize} conversation${metrics.sampleSize !== 1 ? 's' : ''} in the last ${metrics.basedOnDays} days`
      };
    } catch (error) {
      console.error('Error getting public response metrics:', error);
      return {
        displayText: 'Response data temporarily unavailable',
        note: 'Please try again later'
      };
    }
  };

  return User;
};