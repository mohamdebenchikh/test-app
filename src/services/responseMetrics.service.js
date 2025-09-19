const { ResponseMetrics, User, Conversation, Message, sequelize } = require('../models');
const { Op } = require('sequelize');
const httpStatus = require('http-status').default;
const ApiError = require('../utils/ApiError');

/**
 * Track initial message from client to provider
 * @param {string} messageId - The ID of the initial message
 * @param {string} conversationId - The ID of the conversation
 * @param {string} senderId - The ID of the message sender (client)
 * @param {string} receiverId - The ID of the message receiver (provider)
 * @returns {Promise<ResponseMetrics>}
 */
const trackInitialMessage = async (messageId, conversationId, senderId, receiverId) => {
  try {
    // Validate input parameters
    if (!messageId || !conversationId || !senderId || !receiverId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required parameters for tracking initial message');
    }

    // Verify that the message exists
    const message = await Message.findByPk(messageId);
    if (!message) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Initial message not found');
    }

    // Verify that the conversation exists
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
    }

    // Verify that the receiver is a provider
    const receiver = await User.findByPk(receiverId);
    if (!receiver) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Receiver user not found');
    }
    if (receiver.role !== 'provider') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Receiver must be a provider');
    }

    // Verify that the sender is a client
    const sender = await User.findByPk(senderId);
    if (!sender) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Sender user not found');
    }
    if (sender.role !== 'client') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Sender must be a client');
    }

    // Verify message belongs to the conversation
    if (message.conversationId !== conversationId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Message does not belong to the specified conversation');
    }

    // Verify message sender matches provided senderId
    if (message.senderId !== senderId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Message sender does not match provided sender ID');
    }

    // Check if we already have a metric record for this conversation and initial message
    const existingMetric = await ResponseMetrics.findOne({
      where: {
        conversation_id: conversationId,
        initial_message_id: messageId,
        provider_id: receiverId
      }
    });

    if (existingMetric) {
      return existingMetric;
    }

    // Create new response metric record
    const responseMetric = await ResponseMetrics.create({
      provider_id: receiverId,
      conversation_id: conversationId,
      initial_message_id: messageId,
      response_message_id: null,
      response_time_minutes: null,
      responded_within_24h: false
    });

    return responseMetric;
  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Log unexpected errors and throw a generic error
    console.error('Unexpected error in trackInitialMessage:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to track initial message');
  }
};

/**
 * Track provider response to client message
 * @param {string} messageId - The ID of the response message
 * @param {string} conversationId - The ID of the conversation
 * @param {string} senderId - The ID of the message sender (provider)
 * @param {string} receiverId - The ID of the message receiver (client)
 * @returns {Promise<ResponseMetrics|null>}
 */
const trackResponse = async (messageId, conversationId, senderId, receiverId) => {
  try {
    // Validate input parameters
    if (!messageId || !conversationId || !senderId || !receiverId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Missing required parameters for tracking response');
    }

    // Verify that the response message exists
    const responseMessage = await Message.findByPk(messageId);
    if (!responseMessage) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Response message not found');
    }

    // Verify that the conversation exists
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Conversation not found');
    }

    // Verify that the sender is a provider
    const sender = await User.findByPk(senderId);
    if (!sender) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Sender user not found');
    }
    if (sender.role !== 'provider') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Sender must be a provider');
    }

    // Verify that the receiver is a client
    const receiver = await User.findByPk(receiverId);
    if (!receiver) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Receiver user not found');
    }
    if (receiver.role !== 'client') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Receiver must be a client');
    }

    // Verify message belongs to the conversation
    if (responseMessage.conversationId !== conversationId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Response message does not belong to the specified conversation');
    }

    // Verify message sender matches provided senderId
    if (responseMessage.senderId !== senderId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Response message sender does not match provided sender ID');
    }

    // Find the most recent unresponded metric for this provider in this conversation
    const pendingMetric = await ResponseMetrics.findOne({
      where: {
        provider_id: senderId,
        conversation_id: conversationId,
        response_message_id: null
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Message,
          as: 'initialMessage',
          attributes: ['id', 'createdAt'],
          required: false // Allow null in case message was deleted
        }
      ]
    });

    if (!pendingMetric) {
      // No pending metric found - this might be a follow-up message
      return null;
    }

    // Handle case where initial message was deleted
    if (!pendingMetric.initialMessage) {
      console.warn(`Initial message ${pendingMetric.initial_message_id} was deleted, removing orphaned metric`);
      await pendingMetric.destroy();
      return null;
    }

    // Validate response timing
    const initialMessageTime = new Date(pendingMetric.initialMessage.createdAt);
    const responseTime = new Date(responseMessage.createdAt);
    
    // Check for invalid timing (response before initial message)
    if (responseTime < initialMessageTime) {
      console.warn(`Invalid response timing: response message ${messageId} created before initial message ${pendingMetric.initial_message_id}`);
      return null;
    }

    // Calculate response time in minutes
    const responseTimeMinutes = Math.round((responseTime - initialMessageTime) / (1000 * 60));

    // Validate response time is reasonable (not negative and not excessively large)
    if (responseTimeMinutes < 0) {
      console.warn(`Negative response time calculated: ${responseTimeMinutes} minutes`);
      return null;
    }

    // Consider responses older than 7 days as stale and don't track them
    const maxResponseTimeMinutes = 7 * 24 * 60; // 7 days in minutes
    if (responseTimeMinutes > maxResponseTimeMinutes) {
      console.warn(`Response time too large (${responseTimeMinutes} minutes), not tracking`);
      return null;
    }

    // Check if response was within 24 hours
    const respondedWithin24h = responseTimeMinutes <= (24 * 60);

    // Update the metric record
    await pendingMetric.update({
      response_message_id: messageId,
      response_time_minutes: responseTimeMinutes,
      responded_within_24h: respondedWithin24h
    });

    // Trigger metric update for the provider (async, don't wait)
    updateProviderMetrics(senderId).catch(error => {
      console.error('Failed to update provider metrics:', error);
    });

    return pendingMetric;
  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Log unexpected errors and throw a generic error
    console.error('Unexpected error in trackResponse:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to track response');
  }
};

/**
 * Update provider metrics (average response time and response rate)
 * @param {string} providerId - The ID of the provider
 * @returns {Promise<Object>}
 */
const updateProviderMetrics = async (providerId) => {
  try {
    // Validate input parameter
    if (!providerId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Provider ID is required');
    }

    // Verify that the user exists and is a provider
    const provider = await User.findByPk(providerId);
    if (!provider) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Provider user not found');
    }
    if (provider.role !== 'provider') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User must be a provider');
    }

    // Get metrics from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const metrics = await ResponseMetrics.findAll({
      where: {
        provider_id: providerId,
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    if (metrics.length === 0) {
      // No metrics available - update provider with null values
      await provider.update({
        average_response_time_minutes: null,
        response_rate_percentage: null,
        metrics_last_updated: new Date()
      });

      return {
        averageResponseTime: null,
        responseRate: null,
        sampleSize: 0
      };
    }

    // Filter out invalid metrics (negative response times, etc.)
    const validMetrics = metrics.filter(m => {
      // Skip metrics with invalid response times
      if (m.response_time_minutes !== null && m.response_time_minutes < 0) {
        console.warn(`Skipping metric with negative response time: ${m.id}`);
        return false;
      }
      
      // Skip metrics with excessively large response times (more than 7 days)
      const maxResponseTimeMinutes = 7 * 24 * 60;
      if (m.response_time_minutes !== null && m.response_time_minutes > maxResponseTimeMinutes) {
        console.warn(`Skipping metric with excessive response time: ${m.id} (${m.response_time_minutes} minutes)`);
        return false;
      }
      
      return true;
    });

    if (validMetrics.length === 0) {
      // All metrics were invalid - update provider with null values
      await provider.update({
        average_response_time_minutes: null,
        response_rate_percentage: null,
        metrics_last_updated: new Date()
      });

      return {
        averageResponseTime: null,
        responseRate: null,
        sampleSize: 0
      };
    }

    // Calculate average response time (only for responses that occurred and are valid)
    const respondedMetrics = validMetrics.filter(m => 
      m.response_time_minutes !== null && 
      m.response_time_minutes > 0
    );
    
    let averageResponseTime = null;
    if (respondedMetrics.length > 0) {
      const totalResponseTime = respondedMetrics.reduce((sum, m) => sum + m.response_time_minutes, 0);
      averageResponseTime = Math.round(totalResponseTime / respondedMetrics.length);
      
      // Ensure average is reasonable
      if (averageResponseTime < 0) {
        console.warn(`Calculated negative average response time: ${averageResponseTime}, setting to null`);
        averageResponseTime = null;
      }
    }

    // Calculate response rate (responses within 24 hours from valid metrics)
    const responsesWithin24h = validMetrics.filter(m => m.responded_within_24h).length;
    let responseRate = 0;
    
    if (validMetrics.length > 0) {
      responseRate = (responsesWithin24h / validMetrics.length) * 100;
      
      // Ensure response rate is within valid bounds
      if (responseRate < 0) {
        responseRate = 0;
      } else if (responseRate > 100) {
        responseRate = 100;
      }
      
      // Round to 2 decimal places
      responseRate = Math.round(responseRate * 100) / 100;
    }

    // Update provider's cached metrics
    await provider.update({
      average_response_time_minutes: averageResponseTime,
      response_rate_percentage: responseRate,
      metrics_last_updated: new Date()
    });

    return {
      averageResponseTime,
      responseRate,
      sampleSize: validMetrics.length
    };
  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Log unexpected errors and throw a generic error
    console.error('Unexpected error in updateProviderMetrics:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update provider metrics');
  }
};

/**
 * Get provider metrics with formatting
 * @param {string} providerId - The ID of the provider
 * @returns {Promise<Object>}
 */
const getProviderMetrics = async (providerId) => {
  try {
    // Validate input parameter
    if (!providerId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Provider ID is required');
    }

    const provider = await User.findByPk(providerId);
    if (!provider) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Provider user not found');
    }
    if (provider.role !== 'provider') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User must be a provider');
    }

    // If metrics are stale (older than 1 hour), update them
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    if (!provider.metrics_last_updated || provider.metrics_last_updated < oneHourAgo) {
      try {
        await updateProviderMetrics(providerId);
        await provider.reload();
      } catch (updateError) {
        // Log the error but don't fail the request - return cached data if available
        console.error('Failed to update provider metrics, returning cached data:', updateError);
      }
    }

    return {
      averageResponseTime: provider.average_response_time_minutes,
      responseRate: provider.response_rate_percentage,
      lastUpdated: provider.metrics_last_updated
    };
  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Log unexpected errors and throw a generic error
    console.error('Unexpected error in getProviderMetrics:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get provider metrics');
  }
};

/**
 * Update metrics for all providers with stale data
 * @returns {Promise<Object>} Update results
 */
const updateStaleProviderMetrics = async () => {
  // Find providers whose metrics are older than 1 hour or null
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const staleProviders = await User.findAll({
    where: {
      role: 'provider',
      [Op.or]: [
        { metrics_last_updated: null },
        { metrics_last_updated: { [Op.lt]: oneHourAgo } }
      ]
    },
    attributes: ['id']
  });

  let updatedCount = 0;
  let errorCount = 0;

  for (const provider of staleProviders) {
    try {
      await updateProviderMetrics(provider.id);
      updatedCount++;
    } catch (error) {
      console.error(`Failed to update metrics for provider ${provider.id}:`, error);
      errorCount++;
    }
  }

  return {
    totalProviders: staleProviders.length,
    updatedCount,
    errorCount
  };
};

/**
 * Clean up old metric records (older than 30 days)
 * @returns {Promise<object>} Cleanup results with statistics
 */
const cleanupOldMetrics = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // Count records to be deleted for logging
    const recordsToDelete = await ResponseMetrics.count({
      where: {
        createdAt: {
          [Op.lt]: thirtyDaysAgo
        }
      }
    });

    if (recordsToDelete === 0) {
      return {
        deletedCount: 0,
        cutoffDate: thirtyDaysAgo.toISOString(),
        message: 'No old records found for cleanup'
      };
    }

    // Delete old records
    const deletedCount = await ResponseMetrics.destroy({
      where: {
        createdAt: {
          [Op.lt]: thirtyDaysAgo
        }
      }
    });

    return {
      deletedCount,
      cutoffDate: thirtyDaysAgo.toISOString(),
      message: `Successfully cleaned up ${deletedCount} old response metric records`
    };

  } catch (error) {
    console.error('Error during response metrics cleanup:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to cleanup old response metrics');
  }
};

/**
 * Validate response metrics data integrity
 * @returns {Promise<object>} Validation results
 */
const validateDataIntegrity = async () => {
  try {
    const issues = [];
    let fixedCount = 0;

    // Find metrics with invalid provider_id (non-provider users)
    const invalidProviderMetrics = await ResponseMetrics.findAll({
      include: [
        {
          model: User,
          as: 'provider',
          where: {
            role: { [Op.ne]: 'provider' }
          }
        }
      ]
    });

    if (invalidProviderMetrics.length > 0) {
      issues.push(`Found ${invalidProviderMetrics.length} metrics with non-provider users`);
      
      // Remove invalid metrics
      const deletedInvalid = await ResponseMetrics.destroy({
        where: {
          id: { [Op.in]: invalidProviderMetrics.map(m => m.id) }
        }
      });
      
      fixedCount += deletedInvalid;
      issues.push(`Removed ${deletedInvalid} invalid metrics`);
    }

    // Find metrics with negative response times
    const negativeTimeMetrics = await ResponseMetrics.findAll({
      where: {
        response_time_minutes: { [Op.lt]: 0 }
      }
    });

    if (negativeTimeMetrics.length > 0) {
      issues.push(`Found ${negativeTimeMetrics.length} metrics with negative response times`);
      
      // Fix negative response times by setting them to null
      const [updatedCount] = await ResponseMetrics.update(
        { response_time_minutes: null },
        {
          where: {
            response_time_minutes: { [Op.lt]: 0 }
          }
        }
      );
      
      fixedCount += updatedCount;
      issues.push(`Fixed ${updatedCount} negative response times`);
    }

    // Find orphaned metrics (references to deleted messages/conversations)
    const orphanedMetrics = await ResponseMetrics.findAll({
      where: {
        [Op.or]: [
          {
            initial_message_id: {
              [Op.notIn]: sequelize.literal('(SELECT id FROM messages)')
            }
          },
          {
            conversation_id: {
              [Op.notIn]: sequelize.literal('(SELECT id FROM conversations)')
            }
          }
        ]
      }
    });

    if (orphanedMetrics.length > 0) {
      issues.push(`Found ${orphanedMetrics.length} orphaned metrics`);
      
      // Remove orphaned metrics
      const deletedOrphaned = await ResponseMetrics.destroy({
        where: {
          id: { [Op.in]: orphanedMetrics.map(m => m.id) }
        }
      });
      
      fixedCount += deletedOrphaned;
      issues.push(`Removed ${deletedOrphaned} orphaned metrics`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      fixedCount,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Error during data integrity validation:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to validate response metrics data integrity');
  }
};

module.exports = {
  trackInitialMessage,
  trackResponse,
  updateProviderMetrics,
  updateStaleProviderMetrics,
  getProviderMetrics,
  cleanupOldMetrics,
  validateDataIntegrity
};