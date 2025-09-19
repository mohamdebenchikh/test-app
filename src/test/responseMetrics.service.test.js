const { sequelize, User, Conversation, Message, ResponseMetrics } = require('../models');
const responseMetricsService = require('../services/responseMetrics.service');
const { hashPassword } = require('../utils/password');
const ApiError = require('../utils/ApiError');
const crypto = require('crypto');

// Helper function to generate UUID
const generateUUID = () => {
  return crypto.randomUUID();
};

describe('ResponseMetrics Service', () => {
  let client, provider, conversation, initialMessage, responseMessage;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up all tables
    await ResponseMetrics.destroy({ where: {}, force: true });
    await Message.destroy({ where: {}, force: true });
    await Conversation.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test users
    const hashedPassword = await hashPassword('password123');
    
    client = await User.create({
      name: 'Test Client',
      email: 'client@example.com',
      password: hashedPassword,
      role: 'client'
    });

    provider = await User.create({
      name: 'Test Provider',
      email: 'provider@example.com',
      password: hashedPassword,
      role: 'provider'
    });

    // Create test conversation
    conversation = await Conversation.create({
      userOneId: client.id,
      userTwoId: provider.id
    });

    // Create initial message from client to provider
    initialMessage = await Message.create({
      conversationId: conversation.id,
      senderId: client.id,
      content: 'Hello, I need help with something',
      createdAt: new Date('2024-01-01T10:00:00Z')
    });

    // Create response message from provider to client
    responseMessage = await Message.create({
      conversationId: conversation.id,
      senderId: provider.id,
      content: 'Sure, I can help you with that',
      createdAt: new Date('2024-01-01T12:30:00Z') // 2.5 hours later
    });
  });

  describe('trackInitialMessage', () => {
    test('should create response metric for client message to provider', async () => {
      const metric = await responseMetricsService.trackInitialMessage(
        initialMessage.id,
        conversation.id,
        client.id,
        provider.id
      );

      expect(metric).toBeDefined();
      expect(metric.provider_id).toBe(provider.id);
      expect(metric.conversation_id).toBe(conversation.id);
      expect(metric.initial_message_id).toBe(initialMessage.id);
      expect(metric.response_message_id).toBeNull();
      expect(metric.response_time_minutes).toBeNull();
      expect(metric.responded_within_24h).toBe(false);
    });

    test('should return existing metric if already tracked', async () => {
      // Create first metric
      const metric1 = await responseMetricsService.trackInitialMessage(
        initialMessage.id,
        conversation.id,
        client.id,
        provider.id
      );

      // Try to create again
      const metric2 = await responseMetricsService.trackInitialMessage(
        initialMessage.id,
        conversation.id,
        client.id,
        provider.id
      );

      expect(metric1.id).toBe(metric2.id);
      
      // Verify only one record exists
      const count = await ResponseMetrics.count({
        where: {
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id
        }
      });
      expect(count).toBe(1);
    });

    test('should throw error if receiver is not a provider', async () => {
      const anotherClient = await User.create({
        name: 'Another Client',
        email: 'client2@example.com',
        password: await hashPassword('password123'),
        role: 'client'
      });

      await expect(
        responseMetricsService.trackInitialMessage(
          initialMessage.id,
          conversation.id,
          client.id,
          anotherClient.id
        )
      ).rejects.toThrow(ApiError);
    });

    test('should throw error if sender is not a client', async () => {
      const anotherProvider = await User.create({
        name: 'Another Provider',
        email: 'provider2@example.com',
        password: await hashPassword('password123'),
        role: 'provider'
      });

      await expect(
        responseMetricsService.trackInitialMessage(
          initialMessage.id,
          conversation.id,
          anotherProvider.id,
          provider.id
        )
      ).rejects.toThrow(ApiError);
    });
  });

  describe('trackResponse', () => {
    beforeEach(async () => {
      // Create initial metric
      await responseMetricsService.trackInitialMessage(
        initialMessage.id,
        conversation.id,
        client.id,
        provider.id
      );
    });

    test('should update response metric when provider responds', async () => {
      const updatedMetric = await responseMetricsService.trackResponse(
        responseMessage.id,
        conversation.id,
        provider.id,
        client.id
      );

      expect(updatedMetric).toBeDefined();
      expect(updatedMetric.response_message_id).toBe(responseMessage.id);
      expect(updatedMetric.response_time_minutes).toBe(150); // 2.5 hours = 150 minutes
      expect(updatedMetric.responded_within_24h).toBe(true);
    });

    test('should calculate response time correctly for quick response', async () => {
      // Create a quick response (30 minutes later)
      const quickResponse = await Message.create({
        conversationId: conversation.id,
        senderId: provider.id,
        content: 'Quick response',
        createdAt: new Date('2024-01-01T10:30:00Z')
      });

      const updatedMetric = await responseMetricsService.trackResponse(
        quickResponse.id,
        conversation.id,
        provider.id,
        client.id
      );

      expect(updatedMetric.response_time_minutes).toBe(30);
      expect(updatedMetric.responded_within_24h).toBe(true);
    });

    test('should mark as not responded within 24h for late response', async () => {
      // Create a late response (25 hours later)
      const lateResponse = await Message.create({
        conversationId: conversation.id,
        senderId: provider.id,
        content: 'Late response',
        createdAt: new Date('2024-01-02T11:00:00Z')
      });

      const updatedMetric = await responseMetricsService.trackResponse(
        lateResponse.id,
        conversation.id,
        provider.id,
        client.id
      );

      expect(updatedMetric.response_time_minutes).toBe(1500); // 25 hours = 1500 minutes
      expect(updatedMetric.responded_within_24h).toBe(false);
    });

    test('should return null if no pending metric found', async () => {
      // Create a new conversation without initial tracking
      const newConversation = await Conversation.create({
        userOneId: client.id,
        userTwoId: provider.id
      });

      const newResponse = await Message.create({
        conversationId: newConversation.id,
        senderId: provider.id,
        content: 'Response without initial tracking'
      });

      const result = await responseMetricsService.trackResponse(
        newResponse.id,
        newConversation.id,
        provider.id,
        client.id
      );

      expect(result).toBeNull();
    });

    test('should throw error if sender is not a provider', async () => {
      await expect(
        responseMetricsService.trackResponse(
          responseMessage.id,
          conversation.id,
          client.id, // Client as sender
          provider.id
        )
      ).rejects.toThrow(ApiError);
    });

    test('should throw error if receiver is not a client', async () => {
      const anotherProvider = await User.create({
        name: 'Another Provider',
        email: 'provider2@example.com',
        password: await hashPassword('password123'),
        role: 'provider'
      });

      await expect(
        responseMetricsService.trackResponse(
          responseMessage.id,
          conversation.id,
          provider.id,
          anotherProvider.id // Provider as receiver
        )
      ).rejects.toThrow(ApiError);
    });
  });

  describe('updateProviderMetrics', () => {
    beforeEach(async () => {
      // Create multiple response metrics for testing with recent dates
      const now = new Date();
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const metrics = [
        {
          provider_id: provider.id,
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id,
          response_message_id: responseMessage.id,
          response_time_minutes: 60,
          responded_within_24h: true,
          createdAt: oneDayAgo
        },
        {
          provider_id: provider.id,
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id,
          response_message_id: null,
          response_time_minutes: null,
          responded_within_24h: false,
          createdAt: twoDaysAgo
        },
        {
          provider_id: provider.id,
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id,
          response_message_id: responseMessage.id,
          response_time_minutes: 120,
          responded_within_24h: true,
          createdAt: threeDaysAgo
        }
      ];

      await ResponseMetrics.bulkCreate(metrics);
    });

    test('should calculate average response time and response rate', async () => {
      const result = await responseMetricsService.updateProviderMetrics(provider.id);

      expect(result.averageResponseTime).toBe(90); // (60 + 120) / 2 = 90
      expect(result.responseRate).toBeCloseTo(66.67, 2); // 2 out of 3 responded within 24h
      expect(result.sampleSize).toBe(3);

      // Check that user record was updated
      await provider.reload();
      expect(provider.average_response_time_minutes).toBe(90);
      expect(provider.response_rate_percentage).toBeCloseTo(66.67, 2);
      expect(provider.metrics_last_updated).toBeTruthy();
    });

    test('should handle provider with no metrics', async () => {
      // Create a new provider with no metrics
      const newProvider = await User.create({
        name: 'New Provider',
        email: 'newprovider@example.com',
        password: await hashPassword('password123'),
        role: 'provider'
      });

      const result = await responseMetricsService.updateProviderMetrics(newProvider.id);

      expect(result.averageResponseTime).toBeNull();
      expect(result.responseRate).toBeNull();
      expect(result.sampleSize).toBe(0);

      // Check that user record was updated
      await newProvider.reload();
      expect(newProvider.average_response_time_minutes).toBeNull();
      expect(newProvider.response_rate_percentage).toBeNull();
      expect(newProvider.metrics_last_updated).toBeTruthy();
    });

    test('should only consider metrics from last 30 days', async () => {
      // Create an old metric (35 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      
      await ResponseMetrics.create({
        provider_id: provider.id,
        conversation_id: conversation.id,
        initial_message_id: initialMessage.id,
        response_message_id: responseMessage.id,
        response_time_minutes: 300,
        responded_within_24h: true,
        createdAt: oldDate
      });

      const result = await responseMetricsService.updateProviderMetrics(provider.id);

      // Should not include the old metric in calculations
      expect(result.sampleSize).toBe(3); // Only the 3 recent metrics
    });

    test('should throw error if user is not a provider', async () => {
      await expect(
        responseMetricsService.updateProviderMetrics(client.id)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getProviderMetrics', () => {
    test('should return cached metrics if recent', async () => {
      // Set cached metrics
      await provider.update({
        average_response_time_minutes: 90,
        response_rate_percentage: 85.5,
        metrics_last_updated: new Date() // Recent update
      });

      const result = await responseMetricsService.getProviderMetrics(provider.id);

      expect(result.averageResponseTime).toBe(90);
      expect(result.responseRate).toBe(85.5);
      expect(result.lastUpdated).toBeTruthy();
    });

    test('should update stale metrics', async () => {
      // Set stale metrics (2 hours ago)
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 2);
      
      await provider.update({
        average_response_time_minutes: 90,
        response_rate_percentage: 85.5,
        metrics_last_updated: staleDate
      });

      // Create some response metrics
      await ResponseMetrics.create({
        provider_id: provider.id,
        conversation_id: conversation.id,
        initial_message_id: initialMessage.id,
        response_message_id: responseMessage.id,
        response_time_minutes: 60,
        responded_within_24h: true
      });

      const result = await responseMetricsService.getProviderMetrics(provider.id);

      // Should have updated metrics
      expect(result.lastUpdated).not.toEqual(staleDate);
    });

    test('should throw error if user is not a provider', async () => {
      await expect(
        responseMetricsService.getProviderMetrics(client.id)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('updateStaleProviderMetrics', () => {
    let provider2;

    beforeEach(async () => {
      // Create a second provider
      provider2 = await User.create({
        name: 'Test Provider 2',
        email: 'provider2@example.com',
        password: await hashPassword('password123'),
        role: 'provider'
      });
    });

    test('should update metrics for providers with stale data', async () => {
      // Set stale metrics for provider1 (2 hours ago)
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 2);
      
      await provider.update({
        average_response_time_minutes: 90,
        response_rate_percentage: 85.5,
        metrics_last_updated: staleDate
      });

      // Set recent metrics for provider2 (30 minutes ago)
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 30);
      
      await provider2.update({
        average_response_time_minutes: 60,
        response_rate_percentage: 95.0,
        metrics_last_updated: recentDate
      });

      // Create some response metrics for provider1
      await ResponseMetrics.create({
        provider_id: provider.id,
        conversation_id: conversation.id,
        initial_message_id: initialMessage.id,
        response_message_id: responseMessage.id,
        response_time_minutes: 60,
        responded_within_24h: true
      });

      const result = await responseMetricsService.updateStaleProviderMetrics();

      expect(result.totalProviders).toBe(1); // Only provider1 should be updated
      expect(result.updatedCount).toBe(1);
      expect(result.errorCount).toBe(0);

      // Verify provider1 metrics were updated
      await provider.reload();
      expect(provider.metrics_last_updated).not.toEqual(staleDate);

      // Verify provider2 metrics were not updated
      await provider2.reload();
      expect(provider2.metrics_last_updated).toEqual(recentDate);
    });

    test('should update providers with null metrics_last_updated', async () => {
      // Leave provider metrics_last_updated as null
      await provider.update({
        metrics_last_updated: null
      });

      // Set provider2 to have recent metrics so it's not included
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 30);
      await provider2.update({
        metrics_last_updated: recentDate
      });

      // Create some response metrics
      await ResponseMetrics.create({
        provider_id: provider.id,
        conversation_id: conversation.id,
        initial_message_id: initialMessage.id,
        response_message_id: responseMessage.id,
        response_time_minutes: 60,
        responded_within_24h: true
      });

      const result = await responseMetricsService.updateStaleProviderMetrics();

      expect(result.totalProviders).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(result.errorCount).toBe(0);

      // Verify metrics were updated
      await provider.reload();
      expect(provider.metrics_last_updated).toBeTruthy();
    });

    test('should handle errors gracefully', async () => {
      // Set stale metrics for provider1
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 2);
      
      await provider.update({
        metrics_last_updated: staleDate
      });

      // Set provider2 to have recent metrics so it's not included
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 30);
      await provider2.update({
        metrics_last_updated: recentDate
      });

      // Temporarily replace the updateProviderMetrics function to simulate error
      const originalUpdateProviderMetrics = responseMetricsService.updateProviderMetrics;
      responseMetricsService.updateProviderMetrics = async () => {
        throw new Error('Test error');
      };

      const result = await responseMetricsService.updateStaleProviderMetrics();

      expect(result.totalProviders).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.errorCount).toBe(1);

      // Restore original function
      responseMetricsService.updateProviderMetrics = originalUpdateProviderMetrics;
    });

    test('should return zero counts when no stale providers exist', async () => {
      // Set recent metrics for all providers
      const recentDate = new Date();
      recentDate.setMinutes(recentDate.getMinutes() - 30);
      
      await provider.update({
        metrics_last_updated: recentDate
      });
      
      await provider2.update({
        metrics_last_updated: recentDate
      });

      const result = await responseMetricsService.updateStaleProviderMetrics();

      expect(result.totalProviders).toBe(0);
      expect(result.updatedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('automatic metric updates', () => {
    beforeEach(async () => {
      // Create initial metric
      await responseMetricsService.trackInitialMessage(
        initialMessage.id,
        conversation.id,
        client.id,
        provider.id
      );
    });

    test('should trigger metric update when response is tracked', async () => {
      // Mock console.error to avoid error output in tests
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Set initial cached metrics
      await provider.update({
        average_response_time_minutes: 120,
        response_rate_percentage: 50.0,
        metrics_last_updated: new Date()
      });

      // Track response - this should trigger automatic metric update
      await responseMetricsService.trackResponse(
        responseMessage.id,
        conversation.id,
        provider.id,
        client.id
      );

      // Wait a bit for async update to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify metrics were updated
      await provider.reload();
      expect(provider.average_response_time_minutes).toBe(150); // 2.5 hours = 150 minutes
      expect(provider.response_rate_percentage).toBe(100); // 1 out of 1 responded

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('cleanupOldMetrics', () => {
    test('should delete metrics older than 30 days', async () => {
      // Create metrics with different ages
      const now = new Date();
      const twentyDaysAgo = new Date(now);
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      
      const fortyDaysAgo = new Date(now);
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      await ResponseMetrics.bulkCreate([
        {
          provider_id: provider.id,
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id,
          response_time_minutes: 60,
          responded_within_24h: true,
          createdAt: twentyDaysAgo // Should be kept
        },
        {
          provider_id: provider.id,
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id,
          response_time_minutes: 120,
          responded_within_24h: true,
          createdAt: fortyDaysAgo // Should be deleted
        }
      ]);

      const result = await responseMetricsService.cleanupOldMetrics();

      expect(result.deletedCount).toBe(1);

      // Verify only recent metric remains
      const remainingCount = await ResponseMetrics.count();
      expect(remainingCount).toBe(1);
    });

    test('should return 0 if no old metrics to delete', async () => {
      // Create only recent metrics
      await ResponseMetrics.create({
        provider_id: provider.id,
        conversation_id: conversation.id,
        initial_message_id: initialMessage.id,
        response_time_minutes: 60,
        responded_within_24h: true
      });

      const result = await responseMetricsService.cleanupOldMetrics();

      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Error Handling and Validation', () => {
    // Store original functions to restore after tests
    let originalUpdateProviderMetrics;

    beforeAll(() => {
      originalUpdateProviderMetrics = responseMetricsService.updateProviderMetrics;
    });

    afterEach(() => {
      // Restore original function after each test
      responseMetricsService.updateProviderMetrics = originalUpdateProviderMetrics;
    });

    describe('trackInitialMessage error handling', () => {
      test('should throw error for missing parameters', async () => {
        await expect(
          responseMetricsService.trackInitialMessage(null, conversation.id, client.id, provider.id)
        ).rejects.toThrow('Missing required parameters');

        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, null, client.id, provider.id)
        ).rejects.toThrow('Missing required parameters');

        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, conversation.id, null, provider.id)
        ).rejects.toThrow('Missing required parameters');

        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, conversation.id, client.id, null)
        ).rejects.toThrow('Missing required parameters');
      });

      test('should throw error for non-existent message', async () => {
        const fakeMessageId = '550e8400-e29b-41d4-a716-446655440000';
        
        await expect(
          responseMetricsService.trackInitialMessage(fakeMessageId, conversation.id, client.id, provider.id)
        ).rejects.toThrow('Initial message not found');
      });

      test('should throw error for non-existent conversation', async () => {
        const fakeConversationId = '550e8400-e29b-41d4-a716-446655440000';
        
        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, fakeConversationId, client.id, provider.id)
        ).rejects.toThrow('Conversation not found');
      });

      test('should throw error for non-existent users', async () => {
        const fakeUserId = '550e8400-e29b-41d4-a716-446655440000';
        
        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, conversation.id, fakeUserId, provider.id)
        ).rejects.toThrow('Sender user not found');

        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, conversation.id, client.id, fakeUserId)
        ).rejects.toThrow('Receiver user not found');
      });

      test('should throw error for message not belonging to conversation', async () => {
        // Create another conversation
        const otherConversation = await Conversation.create({
          userOneId: client.id,
          userTwoId: provider.id
        });

        await expect(
          responseMetricsService.trackInitialMessage(initialMessage.id, otherConversation.id, client.id, provider.id)
        ).rejects.toThrow('Message does not belong to the specified conversation');
      });

      test('should throw error for message sender mismatch', async () => {
        // Create a message from a different sender
        const otherClient = await User.create({
          name: 'Other Client',
          email: 'other@example.com',
          password: await hashPassword('password123'),
          role: 'client'
        });

        const otherMessage = await Message.create({
          conversationId: conversation.id,
          senderId: otherClient.id,
          content: 'Message from other client'
        });

        await expect(
          responseMetricsService.trackInitialMessage(otherMessage.id, conversation.id, client.id, provider.id)
        ).rejects.toThrow('Message sender does not match provided sender ID');
      });
    });

    describe('trackResponse error handling', () => {
      beforeEach(async () => {
        // Create initial metric
        await responseMetricsService.trackInitialMessage(
          initialMessage.id,
          conversation.id,
          client.id,
          provider.id
        );
      });

      test('should throw error for missing parameters', async () => {
        await expect(
          responseMetricsService.trackResponse(null, conversation.id, provider.id, client.id)
        ).rejects.toThrow('Missing required parameters');

        await expect(
          responseMetricsService.trackResponse(responseMessage.id, null, provider.id, client.id)
        ).rejects.toThrow('Missing required parameters');

        await expect(
          responseMetricsService.trackResponse(responseMessage.id, conversation.id, null, client.id)
        ).rejects.toThrow('Missing required parameters');

        await expect(
          responseMetricsService.trackResponse(responseMessage.id, conversation.id, provider.id, null)
        ).rejects.toThrow('Missing required parameters');
      });

      test('should throw error for non-existent response message', async () => {
        const fakeMessageId = '550e8400-e29b-41d4-a716-446655440000';
        
        await expect(
          responseMetricsService.trackResponse(fakeMessageId, conversation.id, provider.id, client.id)
        ).rejects.toThrow('Response message not found');
      });

      test('should handle deleted initial message gracefully', async () => {
        // Store the initial message ID before deletion
        const initialMessageId = initialMessage.id;
        
        // Delete the initial message (disable foreign key constraints temporarily)
        await sequelize.query('PRAGMA foreign_keys = OFF;');
        await Message.destroy({ where: { id: initialMessageId }, force: true });
        await sequelize.query('PRAGMA foreign_keys = ON;');

        const result = await responseMetricsService.trackResponse(
          responseMessage.id,
          conversation.id,
          provider.id,
          client.id
        );

        expect(result).toBeNull();

        // Verify the orphaned metric was removed
        const orphanedMetric = await ResponseMetrics.findOne({
          where: {
            initial_message_id: initialMessageId
          }
        });
        expect(orphanedMetric).toBeNull();
      });

      test('should handle invalid response timing', async () => {
        // Create a response message with timestamp before initial message
        const invalidResponse = await Message.create({
          conversationId: conversation.id,
          senderId: provider.id,
          content: 'Invalid response',
          createdAt: new Date('2023-12-31T09:00:00Z') // Before initial message
        });

        const result = await responseMetricsService.trackResponse(
          invalidResponse.id,
          conversation.id,
          provider.id,
          client.id
        );

        expect(result).toBeNull();
      });

      test('should handle excessively large response times', async () => {
        // Create a response message 8 days later (exceeds 7-day limit)
        const lateResponse = await Message.create({
          conversationId: conversation.id,
          senderId: provider.id,
          content: 'Very late response',
          createdAt: new Date('2024-01-09T10:00:00Z') // 8 days after initial message
        });

        const result = await responseMetricsService.trackResponse(
          lateResponse.id,
          conversation.id,
          provider.id,
          client.id
        );

        expect(result).toBeNull();
      });

      test('should throw error for response message not belonging to conversation', async () => {
        // Create another conversation and message
        const otherConversation = await Conversation.create({
          userOneId: client.id,
          userTwoId: provider.id
        });

        const otherMessage = await Message.create({
          conversationId: otherConversation.id,
          senderId: provider.id,
          content: 'Message in other conversation'
        });

        await expect(
          responseMetricsService.trackResponse(otherMessage.id, conversation.id, provider.id, client.id)
        ).rejects.toThrow('Response message does not belong to the specified conversation');
      });
    });

    describe('updateProviderMetrics error handling', () => {
      describe('parameter validation', () => {
        test('should throw error for missing provider ID', async () => {
          await expect(
            originalUpdateProviderMetrics.call(responseMetricsService, null)
          ).rejects.toThrow('Provider ID is required');

          await expect(
            originalUpdateProviderMetrics.call(responseMetricsService, '')
          ).rejects.toThrow('Provider ID is required');
        });

        test('should throw error for non-existent provider', async () => {
          const fakeProviderId = '550e8400-e29b-41d4-a716-446655440000';
          
          await expect(
            originalUpdateProviderMetrics.call(responseMetricsService, fakeProviderId)
          ).rejects.toThrow('Provider user not found');
        });
      });

      describe('invalid metrics handling', () => {
        test('should handle metrics with invalid response times', async () => {
          // Create metrics with invalid data using raw SQL to bypass validation
          await sequelize.query(`
            INSERT INTO response_metrics (id, provider_id, conversation_id, initial_message_id, response_time_minutes, responded_within_24h, createdAt, updatedAt)
            VALUES 
              ('${generateUUID()}', '${provider.id}', '${conversation.id}', '${initialMessage.id}', -30, 1, datetime('now'), datetime('now')),
              ('${generateUUID()}', '${provider.id}', '${conversation.id}', '${initialMessage.id}', 15000, 0, datetime('now'), datetime('now')),
              ('${generateUUID()}', '${provider.id}', '${conversation.id}', '${initialMessage.id}', 60, 1, datetime('now'), datetime('now'))
          `);

          const result = await originalUpdateProviderMetrics.call(responseMetricsService, provider.id);

          // Should only count the valid metric
          expect(result.sampleSize).toBe(1);
          expect(result.averageResponseTime).toBe(60);
          expect(result.responseRate).toBe(100);
        });

        test('should handle all invalid metrics gracefully', async () => {
          // Create only invalid metrics using raw SQL
          await sequelize.query(`
            INSERT INTO response_metrics (id, provider_id, conversation_id, initial_message_id, response_time_minutes, responded_within_24h, createdAt, updatedAt)
            VALUES 
              ('${generateUUID()}', '${provider.id}', '${conversation.id}', '${initialMessage.id}', -30, 1, datetime('now'), datetime('now')),
              ('${generateUUID()}', '${provider.id}', '${conversation.id}', '${initialMessage.id}', 15000, 0, datetime('now'), datetime('now'))
          `);

          const result = await originalUpdateProviderMetrics.call(responseMetricsService, provider.id);

          expect(result.sampleSize).toBe(0);
          expect(result.averageResponseTime).toBeNull();
          expect(result.responseRate).toBeNull();

          // Verify provider record was updated with null values
          await provider.reload();
          expect(provider.average_response_time_minutes).toBeNull();
          expect(provider.response_rate_percentage).toBeNull();
        });
      });
    });

    describe('getProviderMetrics error handling', () => {
      test('should throw error for missing provider ID', async () => {
        await expect(
          responseMetricsService.getProviderMetrics(null)
        ).rejects.toThrow('Provider ID is required');
      });

      test('should throw error for non-existent provider', async () => {
        const fakeProviderId = '550e8400-e29b-41d4-a716-446655440000';
        
        await expect(
          responseMetricsService.getProviderMetrics(fakeProviderId)
        ).rejects.toThrow('Provider user not found');
      });

      test('should return cached data if metric update fails', async () => {
        // Set stale cached metrics
        const staleDate = new Date();
        staleDate.setHours(staleDate.getHours() - 2);
        
        await provider.update({
          average_response_time_minutes: 90,
          response_rate_percentage: 85.5,
          metrics_last_updated: staleDate
        });

        // Temporarily replace updateProviderMetrics to throw an error
        responseMetricsService.updateProviderMetrics = async () => {
          throw new Error('Update failed');
        };

        const result = await responseMetricsService.getProviderMetrics(provider.id);

        // Should return cached data despite update failure
        expect(result.averageResponseTime).toBe(90);
        expect(result.responseRate).toBe(85.5);
        expect(result.lastUpdated).toEqual(staleDate);
      });
    });

    describe('validateDataIntegrity', () => {
      test('should identify and fix invalid provider metrics', async () => {
        // Create a client user with metrics (invalid) using raw SQL to bypass validation
        const invalidClient = await User.create({
          name: 'Invalid Client',
          email: 'invalid@example.com',
          password: await hashPassword('password123'),
          role: 'client'
        });

        await sequelize.query(`
          INSERT INTO response_metrics (id, provider_id, conversation_id, initial_message_id, response_time_minutes, responded_within_24h, createdAt, updatedAt)
          VALUES ('${generateUUID()}', '${invalidClient.id}', '${conversation.id}', '${initialMessage.id}', 60, 1, datetime('now'), datetime('now'))
        `);

        const result = await responseMetricsService.validateDataIntegrity();

        expect(result.isValid).toBe(false);
        expect(result.issues).toContain('Found 1 metrics with non-provider users');
        expect(result.issues).toContain('Removed 1 invalid metrics');
        expect(result.fixedCount).toBe(1);
      });

      test('should identify and fix negative response times', async () => {
        // Create metric with negative response time using raw SQL
        await sequelize.query(`
          INSERT INTO response_metrics (id, provider_id, conversation_id, initial_message_id, response_time_minutes, responded_within_24h, createdAt, updatedAt)
          VALUES ('${generateUUID()}', '${provider.id}', '${conversation.id}', '${initialMessage.id}', -30, 1, datetime('now'), datetime('now'))
        `);

        const result = await responseMetricsService.validateDataIntegrity();

        expect(result.isValid).toBe(false);
        expect(result.issues).toContain('Found 1 metrics with negative response times');
        expect(result.issues).toContain('Fixed 1 negative response times');
        expect(result.fixedCount).toBe(1);

        // Verify the metric was fixed
        const fixedMetric = await ResponseMetrics.findOne({
          where: { provider_id: provider.id }
        });
        expect(fixedMetric.response_time_minutes).toBeNull();
      });

      test('should return valid status when no issues found', async () => {
        // Create valid metrics
        await ResponseMetrics.create({
          provider_id: provider.id,
          conversation_id: conversation.id,
          initial_message_id: initialMessage.id,
          response_time_minutes: 60,
          responded_within_24h: true
        });

        const result = await responseMetricsService.validateDataIntegrity();

        expect(result.isValid).toBe(true);
        expect(result.issues).toEqual([]);
        expect(result.fixedCount).toBe(0);
      });
    });
  });
});