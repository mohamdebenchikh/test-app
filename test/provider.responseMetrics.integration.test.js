const request = require('supertest');
const app = require('../index');
const { sequelize, User, Conversation, Message, ResponseMetrics, City } = require('../src/models');
const { generateToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/password');
const chatService = require('../src/services/chat.service');
const responseMetricsService = require('../src/services/responseMetrics.service');

describe('Provider Response Metrics - Complete Integration Tests', () => {
  let testCity;
  let client1, client2, provider1, provider2;
  let clientToken1, clientToken2, providerToken1, providerToken2;

  beforeAll(async () => {
    // Clean up database
    await sequelize.sync({ force: true });
    
    // Create test city
    testCity = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de Test'
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await ResponseMetrics.destroy({ where: {} });
    await Message.destroy({ where: {} });
    await Conversation.destroy({ where: {} });
    await User.destroy({ where: {} });

    // Create test users
    client1 = await User.create({
      name: 'Test Client 1',
      email: 'client1@test.com',
      password: await hashPassword('password123'),
      role: 'client',
      isVerified: true,
      city_id: testCity.id
    });

    client2 = await User.create({
      name: 'Test Client 2',
      email: 'client2@test.com',
      password: await hashPassword('password123'),
      role: 'client',
      isVerified: true,
      city_id: testCity.id
    });

    provider1 = await User.create({
      name: 'Test Provider 1',
      email: 'provider1@test.com',
      password: await hashPassword('password123'),
      role: 'provider',
      bio: 'I am a test provider',
      phone_number: '+1234567890',
      isVerified: true,
      city_id: testCity.id
    });

    provider2 = await User.create({
      name: 'Test Provider 2',
      email: 'provider2@test.com',
      password: await hashPassword('password123'),
      role: 'provider',
      bio: 'I am another test provider',
      phone_number: '+0987654321',
      isVerified: true,
      city_id: testCity.id
    });

    // Generate tokens
    clientToken1 = generateToken({ userId: client1.id });
    clientToken2 = generateToken({ userId: client2.id });
    providerToken1 = generateToken({ userId: provider1.id });
    providerToken2 = generateToken({ userId: provider2.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('End-to-End Client-Provider Message Flow with Metrics', () => {
    test('should track complete message flow from client inquiry to provider response', async () => {
      // Step 1: Client sends initial message to provider
      const initialMessage = await chatService.handleSendMessage(
        client1.id,
        provider1.id,
        'Hello, I need help with my plumbing issue'
      );

      expect(initialMessage).toBeDefined();
      expect(initialMessage.content).toBe('Hello, I need help with my plumbing issue');

      // Verify initial metric was created
      const initialMetric = await ResponseMetrics.findOne({
        where: {
          provider_id: provider1.id,
          initial_message_id: initialMessage.id
        }
      });

      expect(initialMetric).toBeDefined();
      expect(initialMetric.provider_id).toBe(provider1.id);
      expect(initialMetric.conversation_id).toBe(initialMessage.conversationId);
      expect(initialMetric.response_message_id).toBeNull();
      expect(initialMetric.response_time_minutes).toBeNull();
      expect(initialMetric.responded_within_24h).toBe(false);

      // Step 2: Provider responds to client
      const responseMessage = await chatService.handleSendMessage(
        provider1.id,
        client1.id,
        'Hi! I can help you with that. What specific plumbing issue are you having?'
      );

      expect(responseMessage).toBeDefined();
      expect(responseMessage.senderId).toBe(provider1.id);

      // Verify metric was updated with response
      const updatedMetric = await ResponseMetrics.findOne({
        where: {
          provider_id: provider1.id,
          initial_message_id: initialMessage.id
        }
      });

      expect(updatedMetric).toBeDefined();
      expect(updatedMetric.response_message_id).toBe(responseMessage.id);
      expect(updatedMetric.response_time_minutes).toBeDefined();
      expect(updatedMetric.response_time_minutes).toBeGreaterThanOrEqual(0);
      expect(updatedMetric.responded_within_24h).toBe(true);

      // Step 3: Verify provider metrics are calculated correctly
      const providerMetrics = await provider1.calculateResponseMetrics();
      expect(providerMetrics.sampleSize).toBe(1);
      expect(providerMetrics.responseRate).toBe(100);
      expect(providerMetrics.averageResponseTime).toBeDefined();
      expect(providerMetrics.hasInsufficientData).toBe(true); // Less than 3 conversations
    });

    test('should handle multiple conversations with different response patterns', async () => {
      // Conversation 1: Quick response
      const msg1 = await chatService.handleSendMessage(client1.id, provider1.id, 'Quick question');
      await chatService.handleSendMessage(provider1.id, client1.id, 'Quick answer');

      // Conversation 2: Slower response (simulate delay)
      const msg2 = await chatService.handleSendMessage(client2.id, provider1.id, 'Complex question');
      const response2 = await chatService.handleSendMessage(provider1.id, client2.id, 'Complex answer');
      
      // Update the metric manually to simulate longer response time
      await ResponseMetrics.update(
        {
          response_time_minutes: 120, // 2 hours
          responded_within_24h: true
        },
        {
          where: {
            provider_id: provider1.id,
            initial_message_id: msg2.id
          }
        }
      );

      // Conversation 3: No response
      await chatService.handleSendMessage(client1.id, provider1.id, 'Unanswered question');

      // Verify metrics calculation - should have 3 metrics from this test
      const metrics = await provider1.calculateResponseMetrics();
      expect(metrics.sampleSize).toBe(3);
      expect(metrics.responseRate).toBe(66.67); // 2 out of 3 responded
      expect(metrics.averageResponseTime).toBeDefined();
      expect(metrics.hasInsufficientData).toBe(false); // 3 or more conversations
    });

    test('should not track metrics for client-to-client conversations', async () => {
      // Client 1 sends message to Client 2
      const message = await chatService.handleSendMessage(
        client1.id,
        client2.id,
        'Hello fellow client'
      );

      expect(message).toBeDefined();

      // Verify no metrics were created
      const metrics = await ResponseMetrics.findAll();
      expect(metrics).toHaveLength(0);
    });

    test('should not track metrics for provider-to-provider conversations', async () => {
      // Provider 1 sends message to Provider 2
      const message = await chatService.handleSendMessage(
        provider1.id,
        provider2.id,
        'Hello fellow provider'
      );

      expect(message).toBeDefined();

      // Verify no metrics were created
      const metrics = await ResponseMetrics.findAll();
      expect(metrics).toHaveLength(0);
    });
  });

  describe('Provider Profile API with Response Metrics', () => {
    test('should display response metrics on provider profile for clients', async () => {
      // Create sample metrics for provider
      await createSampleMetrics(provider1.id, [
        { responseTime: 30, responded: true },
        { responseTime: 60, responded: true },
        { responseTime: 90, responded: true },
        { responseTime: null, responded: false }
      ]);

      // Client views provider profile
      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', provider1.id);
      expect(response.body).toHaveProperty('name', 'Test Provider 1');
      expect(response.body).toHaveProperty('role', 'provider');
      expect(response.body).toHaveProperty('responseMetrics');

      const metrics = response.body.responseMetrics;
      expect(metrics).toHaveProperty('averageResponseTime', '1 hour');
      expect(metrics).toHaveProperty('responseRate', '75%');
      expect(metrics).toHaveProperty('basedOnDays', 30);
      expect(metrics).toHaveProperty('sampleSize', 4);
      expect(metrics).toHaveProperty('note');
    });

    test('should show "No response data available" for providers with insufficient data', async () => {
      // Create only 2 metrics (insufficient for display)
      await createSampleMetrics(provider1.id, [
        { responseTime: 30, responded: true },
        { responseTime: 60, responded: true }
      ]);

      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('responseMetrics');
      const metrics = response.body.responseMetrics;
      expect(metrics).toHaveProperty('displayText', 'No response data available');
      expect(metrics).toHaveProperty('note', 'Metrics will be available after more interactions');
    });

    test('should show "No response data available" for new providers', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('responseMetrics');
      const metrics = response.body.responseMetrics;
      expect(metrics).toHaveProperty('displayText', 'No response data available');
      expect(metrics).toHaveProperty('note', 'Metrics will be available after more interactions');
    });

    test('should format response times correctly', async () => {
      const testCases = [
        { minutes: 30, expected: '30 minutes' },
        { minutes: 60, expected: '1 hour' },
        { minutes: 90, expected: '1 hour 30 minutes' },
        { minutes: 120, expected: '2 hours' },
        { minutes: 1, expected: '1 minute' }
      ];

      for (const testCase of testCases) {
        // Clean up previous metrics
        await ResponseMetrics.destroy({ where: {} });

        // Create metrics with specific response time
        await createSampleMetrics(provider1.id, [
          { responseTime: testCase.minutes, responded: true },
          { responseTime: testCase.minutes, responded: true },
          { responseTime: testCase.minutes, responded: true }
        ]);

        const response = await request(app)
          .get(`/api/users/providers/${provider1.id}/profile`)
          .expect(200);

        const metrics = response.body.responseMetrics;
        expect(metrics.averageResponseTime).toBe(testCase.expected);
      }
    });
  });

  describe('Privacy Controls and Role-Based Visibility', () => {
    test('should only show response metrics for providers, not clients', async () => {
      // Try to get client profile
      const clientResponse = await request(app)
        .get(`/api/users/clients/${client1.id}/profile`)
        .expect(200);

      expect(clientResponse.body).toHaveProperty('id', client1.id);
      expect(clientResponse.body).toHaveProperty('role', 'client');
      expect(clientResponse.body).not.toHaveProperty('responseMetrics');

      // Get provider profile
      const providerResponse = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      expect(providerResponse.body).toHaveProperty('id', provider1.id);
      expect(providerResponse.body).toHaveProperty('role', 'provider');
      expect(providerResponse.body).toHaveProperty('responseMetrics');
    });

    test('should return 404 when trying to access client via provider endpoint', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${client1.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Provider not found');
    });

    test('should return 404 when trying to access provider via client endpoint', async () => {
      const response = await request(app)
        .get(`/api/users/clients/${provider1.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Client not found');
    });

    test('should not expose sensitive user information in profile', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      // Should not expose password or verification status
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('verify');
      
      // Should expose public profile information
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('bio');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('phone_number');
    });

    test('should handle inactive providers correctly', async () => {
      // Deactivate provider
      await provider1.update({ active: false });

      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Provider not found');
    });
  });

  describe('Performance Testing with Realistic Data Volumes', () => {
    test('should handle large number of response metrics efficiently', async () => {
      const startTime = Date.now();
      
      // Create 50 response metrics for the provider (reduced for performance)
      const metricsConfig = [];
      for (let i = 0; i < 50; i++) {
        metricsConfig.push({
          responseTime: i % 4 === 0 ? null : Math.floor(Math.random() * 300) + 10, // 10-310 minutes
          responded: i % 4 !== 0
        });
      }

      await createSampleMetrics(provider1.id, metricsConfig);

      // Test metric calculation performance
      const calcStartTime = Date.now();
      const metrics = await provider1.calculateResponseMetrics();
      const calcEndTime = Date.now();

      expect(metrics.sampleSize).toBe(50);
      expect(metrics.responseRate).toBeDefined();
      expect(metrics.averageResponseTime).toBeDefined();
      expect(metrics.hasInsufficientData).toBe(false);

      // Calculation should complete within reasonable time (< 2 seconds)
      expect(calcEndTime - calcStartTime).toBeLessThan(2000);

      // Test API response performance
      const apiStartTime = Date.now();
      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);
      const apiEndTime = Date.now();

      expect(response.body).toHaveProperty('responseMetrics');
      expect(response.body.responseMetrics).toHaveProperty('sampleSize', 50);

      // API response should complete within reasonable time (< 2 seconds)
      expect(apiEndTime - apiStartTime).toBeLessThan(2000);

      const endTime = Date.now();
      console.log(`Performance test completed in ${endTime - startTime}ms`);
    });

    test('should handle concurrent metric calculations efficiently', async () => {
      // Create metrics for multiple providers
      const providers = [provider1, provider2];
      
      for (const provider of providers) {
        const metricsConfig = [];
        for (let i = 0; i < 25; i++) { // Reduced for performance
          metricsConfig.push({
            responseTime: i % 3 === 0 ? null : Math.floor(Math.random() * 200) + 5,
            responded: i % 3 !== 0
          });
        }
        await createSampleMetrics(provider.id, metricsConfig);
      }

      // Test concurrent API calls
      const startTime = Date.now();
      const promises = providers.map(provider =>
        request(app).get(`/api/users/providers/${provider.id}/profile`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('responseMetrics');
        expect(response.body.responseMetrics).toHaveProperty('sampleSize', 25);
      });

      // Concurrent requests should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(3000);
      console.log(`Concurrent test completed in ${endTime - startTime}ms`);
    });

    test('should handle edge cases with invalid data gracefully', async () => {
      // Create metrics with edge case data
      await createSampleMetrics(provider1.id, [
        { responseTime: -10, responded: false }, // Invalid negative time (will be set to null), no response
        { responseTime: 15000, responded: false }, // Invalid excessive time (10+ days)
        { responseTime: 60, responded: true } // Valid time
      ]);

      // Should handle invalid data gracefully
      const metrics = await provider1.calculateResponseMetrics();
      expect(metrics.sampleSize).toBe(2); // 2 valid metrics (negative time becomes null, excessive time filtered out)
      expect(metrics.averageResponseTime).toBe(60); // Only the valid 60-minute response is counted
      expect(metrics.responseRate).toBe(50); // 1 out of 2 responded
      expect(metrics.hasInsufficientData).toBe(true);

      // API should still work
      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('responseMetrics');
      expect(response.body.responseMetrics).toHaveProperty('displayText', 'No response data available');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle database errors gracefully in metric calculation', async () => {
      // Create some valid metrics first
      await createSampleMetrics(provider1.id, [
        { responseTime: 30, responded: true },
        { responseTime: 60, responded: true },
        { responseTime: 90, responded: true }
      ]);

      // Mock database error
      const originalFindAll = ResponseMetrics.findAll;
      ResponseMetrics.findAll = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/users/providers/${provider1.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('responseMetrics');
      // Should show error state gracefully
      expect(response.body.responseMetrics.displayText).toBe('Response data temporarily unavailable');

      // Restore original function
      ResponseMetrics.findAll = originalFindAll;
    });

    test('should continue message flow even if metric tracking fails', async () => {
      // Mock responseMetricsService to throw error
      const originalTrackInitialMessage = responseMetricsService.trackInitialMessage;
      responseMetricsService.trackInitialMessage = jest.fn().mockRejectedValue(new Error('Metric tracking failed'));

      // Message should still be created despite metric tracking failure
      const message = await chatService.handleSendMessage(
        client1.id,
        provider1.id,
        'Hello, this should work despite metric error'
      );

      expect(message).toBeDefined();
      expect(message.content).toBe('Hello, this should work despite metric error');

      // Restore original function
      responseMetricsService.trackInitialMessage = originalTrackInitialMessage;
    });

    test('should handle missing users in metric tracking', async () => {
      // Try to track metrics with non-existent user IDs
      const nonExistentUserId = '99999999-9999-9999-9999-999999999999';
      
      // This should handle the error gracefully and not crash the system
      try {
        await responseMetricsService.trackInitialMessage(
          'msg-id',
          'conv-id',
          nonExistentUserId,
          provider1.id
        );
      } catch (error) {
        // Expected to throw an error for non-existent users
        expect(error).toBeDefined();
      }
    });
  });

  describe('Data Consistency and Integrity', () => {
    test('should maintain data consistency across multiple operations', async () => {
      // Create a conversation with multiple message exchanges
      const conversation = await Conversation.create({
        userOneId: client1.id,
        userTwoId: provider1.id
      });

      // Client sends initial message
      const msg1 = await Message.create({
        conversationId: conversation.id,
        senderId: client1.id,
        content: 'First message'
      });

      // Track initial message
      await responseMetricsService.trackInitialMessage(
        msg1.id,
        conversation.id,
        client1.id,
        provider1.id
      );

      // Provider responds
      const response1 = await Message.create({
        conversationId: conversation.id,
        senderId: provider1.id,
        content: 'First response'
      });

      // Track response
      await responseMetricsService.trackResponse(
        response1.id,
        conversation.id,
        provider1.id,
        client1.id
      );

      // Verify metric was created and updated correctly
      const metric = await ResponseMetrics.findOne({
        where: {
          provider_id: provider1.id,
          initial_message_id: msg1.id
        }
      });

      expect(metric).toBeDefined();
      expect(metric.response_message_id).toBe(response1.id);
      expect(metric.response_time_minutes).toBeDefined();
      expect(metric.responded_within_24h).toBe(true);

      // Verify provider metrics reflect the data
      const providerMetrics = await provider1.calculateResponseMetrics();
      expect(providerMetrics.sampleSize).toBe(1);
      expect(providerMetrics.responseRate).toBe(100);
    });

    test('should handle cleanup of old metrics correctly', async () => {
      // Create old metrics (older than 30 days)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);

      // Create conversation and messages for old metric
      const oldConversation = await Conversation.create({
        userOneId: client1.id,
        userTwoId: provider1.id
      });
      
      const oldInitialMessage = await Message.create({
        conversationId: oldConversation.id,
        senderId: client1.id,
        content: 'Old message'
      });
      
      const oldResponseMessage = await Message.create({
        conversationId: oldConversation.id,
        senderId: provider1.id,
        content: 'Old response'
      });

      const oldMetric = await ResponseMetrics.create({
        provider_id: provider1.id,
        conversation_id: oldConversation.id,
        initial_message_id: oldInitialMessage.id,
        response_message_id: oldResponseMessage.id,
        response_time_minutes: 60,
        responded_within_24h: true,
        createdAt: oldDate
      });

      // Create recent metric
      const recentMetrics = await createSampleMetrics(provider1.id, [
        { responseTime: 30, responded: true }
      ]);
      const recentMetric = recentMetrics[0];

      // Metrics calculation should only consider recent data
      const metrics = await provider1.calculateResponseMetrics();
      expect(metrics.sampleSize).toBe(1); // Only recent metric
      expect(metrics.averageResponseTime).toBe(30);

      // Cleanup old metrics
      await responseMetricsService.cleanupOldMetrics();

      // Verify old metric was removed
      const remainingMetrics = await ResponseMetrics.findAll();
      expect(remainingMetrics).toHaveLength(1);
      expect(remainingMetrics[0].id).toBe(recentMetric.id);
    });
  });

  // Helper function to create sample metrics
  async function createSampleMetrics(providerId, metricsConfig) {
    const metrics = [];
    
    for (let i = 0; i < metricsConfig.length; i++) {
      const config = metricsConfig[i];
      
      // Create conversation and messages first to satisfy foreign key constraints
      const conversation = await Conversation.create({
        userOneId: client1.id,
        userTwoId: providerId
      });
      
      const initialMessage = await Message.create({
        conversationId: conversation.id,
        senderId: client1.id,
        content: `Test message ${i + 1}`
      });
      
      let responseMessage = null;
      if (config.responded) {
        responseMessage = await Message.create({
          conversationId: conversation.id,
          senderId: providerId,
          content: `Test response ${i + 1}`
        });
      }
      
      const metric = await ResponseMetrics.create({
        provider_id: providerId,
        conversation_id: conversation.id,
        initial_message_id: initialMessage.id,
        response_message_id: responseMessage ? responseMessage.id : null,
        response_time_minutes: config.responseTime && config.responseTime >= 0 ? config.responseTime : null,
        responded_within_24h: config.responded,
        createdAt: new Date()
      });
      
      metrics.push(metric);
    }
    
    return metrics;
  }
});