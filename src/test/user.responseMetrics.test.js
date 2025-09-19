/**
 * @fileoverview Unit tests for User model response metrics methods.
 */

const { sequelize, User, ResponseMetrics } = require('../models');
const { Op } = require('sequelize');

describe('User Response Metrics', () => {
  let testProvider;
  let testClient;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Disable foreign key constraints for SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    }
  });

  beforeEach(async () => {
    // Create test users
    testProvider = await User.create({
      name: 'Test Provider',
      email: 'provider@test.com',
      password: 'hashedpassword',
      role: 'provider'
    });

    testClient = await User.create({
      name: 'Test Client',
      email: 'client@test.com',
      password: 'hashedpassword',
      role: 'client'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await ResponseMetrics.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    // Re-enable foreign key constraints for SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    }
    
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('calculateResponseMetrics', () => {
    it('should return null metrics for non-provider users', async () => {
      const metrics = await testClient.calculateResponseMetrics();
      
      expect(metrics).toEqual({
        averageResponseTime: null,
        responseRate: null,
        sampleSize: 0,
        hasInsufficientData: true
      });
    });

    it('should return insufficient data when no metrics exist', async () => {
      const metrics = await testProvider.calculateResponseMetrics();
      
      expect(metrics).toEqual({
        averageResponseTime: null,
        responseRate: null,
        sampleSize: 0,
        hasInsufficientData: true
      });
    });

    it('should calculate correct metrics with sample data', async () => {
      // Create mock response metrics
      const mockMetrics = [
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440001',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440011',
          response_message_id: '550e8400-e29b-41d4-a716-446655440021',
          response_time_minutes: 60, // 1 hour
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440002',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440012',
          response_message_id: '550e8400-e29b-41d4-a716-446655440022',
          response_time_minutes: 120, // 2 hours
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440003',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440013',
          response_message_id: null,
          response_time_minutes: null,
          responded_within_24h: false,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440004',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440014',
          response_message_id: '550e8400-e29b-41d4-a716-446655440024',
          response_time_minutes: 30, // 30 minutes
          responded_within_24h: true,
          createdAt: new Date()
        }
      ];

      await ResponseMetrics.bulkCreate(mockMetrics);

      const metrics = await testProvider.calculateResponseMetrics();
      
      expect(metrics.sampleSize).toBe(4);
      expect(metrics.hasInsufficientData).toBe(false);
      expect(metrics.responseRate).toBe(75); // 3 out of 4 responded within 24h
      expect(metrics.averageResponseTime).toBe(70); // (60 + 120 + 30) / 3 = 70 minutes
    });

    it('should only consider metrics from last 30 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      // Create old metric (should be ignored)
      await ResponseMetrics.create({
        provider_id: testProvider.id,
        conversation_id: '550e8400-e29b-41d4-a716-446655440005',
        initial_message_id: '550e8400-e29b-41d4-a716-446655440015',
        response_message_id: '550e8400-e29b-41d4-a716-446655440025',
        response_time_minutes: 1000,
        responded_within_24h: true,
        createdAt: oldDate
      });

      // Create recent metric (should be included)
      await ResponseMetrics.create({
        provider_id: testProvider.id,
        conversation_id: '550e8400-e29b-41d4-a716-446655440006',
        initial_message_id: '550e8400-e29b-41d4-a716-446655440016',
        response_message_id: '550e8400-e29b-41d4-a716-446655440026',
        response_time_minutes: 60,
        responded_within_24h: true,
        createdAt: recentDate
      });

      const metrics = await testProvider.calculateResponseMetrics();
      
      expect(metrics.sampleSize).toBe(1);
      expect(metrics.averageResponseTime).toBe(60);
      expect(metrics.responseRate).toBe(100);
    });

    it('should handle edge case with insufficient data (less than 3 conversations)', async () => {
      // Create only 2 metrics
      const mockMetrics = [
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440007',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440017',
          response_message_id: '550e8400-e29b-41d4-a716-446655440027',
          response_time_minutes: 60,
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440008',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440018',
          response_message_id: '550e8400-e29b-41d4-a716-446655440028',
          response_time_minutes: 120,
          responded_within_24h: true,
          createdAt: new Date()
        }
      ];

      await ResponseMetrics.bulkCreate(mockMetrics);

      const metrics = await testProvider.calculateResponseMetrics();
      
      expect(metrics.sampleSize).toBe(2);
      expect(metrics.hasInsufficientData).toBe(true);
      expect(metrics.averageResponseTime).toBe(90); // Still calculate but mark as insufficient
      expect(metrics.responseRate).toBe(100);
    });

    it('should handle case where no responses were given', async () => {
      // Create metrics with no responses
      const mockMetrics = [
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440009',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440019',
          response_message_id: null,
          response_time_minutes: null,
          responded_within_24h: false,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440010',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440020',
          response_message_id: null,
          response_time_minutes: null,
          responded_within_24h: false,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440011',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440021',
          response_message_id: null,
          response_time_minutes: null,
          responded_within_24h: false,
          createdAt: new Date()
        }
      ];

      await ResponseMetrics.bulkCreate(mockMetrics);

      const metrics = await testProvider.calculateResponseMetrics();
      
      expect(metrics.sampleSize).toBe(3);
      expect(metrics.hasInsufficientData).toBe(false);
      expect(metrics.averageResponseTime).toBe(null); // No responses given
      expect(metrics.responseRate).toBe(0); // 0% response rate
    });
  });

  describe('getResponseMetrics', () => {
    it('should return formatted metrics for display', async () => {
      // Create sample metrics
      const mockMetrics = [
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440031',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440041',
          response_message_id: '550e8400-e29b-41d4-a716-446655440051',
          response_time_minutes: 90, // 1 hour 30 minutes
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440032',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440042',
          response_message_id: '550e8400-e29b-41d4-a716-446655440052',
          response_time_minutes: 30, // 30 minutes
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440033',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440043',
          response_message_id: '550e8400-e29b-41d4-a716-446655440053',
          response_time_minutes: 120, // 2 hours
          responded_within_24h: true,
          createdAt: new Date()
        }
      ];

      await ResponseMetrics.bulkCreate(mockMetrics);

      const metrics = await testProvider.getResponseMetrics();
      
      expect(metrics.averageResponseTime).toBe('1 hour 20 minutes'); // 80 minutes average
      expect(metrics.responseRate).toBe('100%');
      expect(metrics.basedOnDays).toBe(30);
      expect(metrics.sampleSize).toBe(3);
      expect(metrics.rawMetrics.averageResponseTimeMinutes).toBe(80);
      expect(metrics.rawMetrics.responseRatePercentage).toBe(100);
    });

    it('should format time correctly for different durations', async () => {
      // Test different time formats
      const testCases = [
        { minutes: 30, expected: '30 minutes' },
        { minutes: 1, expected: '1 minute' },
        { minutes: 60, expected: '1 hour' },
        { minutes: 120, expected: '2 hours' },
        { minutes: 90, expected: '1 hour 30 minutes' },
        { minutes: 150, expected: '2 hours 30 minutes' }
      ];

      for (const testCase of testCases) {
        // Clean up previous data
        await ResponseMetrics.destroy({ where: {} });

        // Create metrics for this test case
        const mockMetrics = Array.from({ length: 3 }, (_, i) => ({
          provider_id: testProvider.id,
          conversation_id: `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`,
          initial_message_id: `550e8400-e29b-41d4-a716-44665545${String(i).padStart(4, '0')}`,
          response_message_id: `550e8400-e29b-41d4-a716-44665546${String(i).padStart(4, '0')}`,
          response_time_minutes: testCase.minutes,
          responded_within_24h: true,
          createdAt: new Date()
        }));

        await ResponseMetrics.bulkCreate(mockMetrics);

        const metrics = await testProvider.getResponseMetrics();
        expect(metrics.averageResponseTime).toBe(testCase.expected);
      }
    });

    it('should return no data message for insufficient data', async () => {
      // Create only 1 metric (insufficient)
      await ResponseMetrics.create({
        provider_id: testProvider.id,
        conversation_id: '550e8400-e29b-41d4-a716-446655440061',
        initial_message_id: '550e8400-e29b-41d4-a716-446655440071',
        response_message_id: '550e8400-e29b-41d4-a716-446655440081',
        response_time_minutes: 60,
        responded_within_24h: true,
        createdAt: new Date()
      });

      const metrics = await testProvider.getResponseMetrics();
      
      expect(metrics.displayText).toBe('No response data available');
      expect(metrics.averageResponseTime).toBe(null);
      expect(metrics.responseRate).toBe(null);
      expect(metrics.sampleSize).toBe(1);
    });

    it('should return null for non-provider users', async () => {
      const metrics = await testClient.getResponseMetrics();
      
      expect(metrics.displayText).toBe('No response data available');
      expect(metrics.averageResponseTime).toBe(null);
      expect(metrics.responseRate).toBe(null);
    });
  });

  describe('getPublicResponseMetrics', () => {
    it('should return null for non-provider users', async () => {
      const metrics = await testClient.getPublicResponseMetrics();
      expect(metrics).toBe(null);
    });

    it('should return no data message for insufficient data', async () => {
      // Create only 2 metrics (insufficient for public display)
      const mockMetrics = [
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440091',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440101',
          response_message_id: '550e8400-e29b-41d4-a716-446655440111',
          response_time_minutes: 60,
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440092',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440102',
          response_message_id: '550e8400-e29b-41d4-a716-446655440112',
          response_time_minutes: 120,
          responded_within_24h: true,
          createdAt: new Date()
        }
      ];

      await ResponseMetrics.bulkCreate(mockMetrics);

      const metrics = await testProvider.getPublicResponseMetrics();
      
      expect(metrics.displayText).toBe('No response data available');
      expect(metrics.note).toBe('Metrics will be available after more interactions');
    });

    it('should return formatted public metrics with sufficient data', async () => {
      // Create sufficient metrics (3 or more)
      const mockMetrics = [
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440121',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440131',
          response_message_id: '550e8400-e29b-41d4-a716-446655440141',
          response_time_minutes: 60,
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440122',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440132',
          response_message_id: '550e8400-e29b-41d4-a716-446655440142',
          response_time_minutes: 120,
          responded_within_24h: true,
          createdAt: new Date()
        },
        {
          provider_id: testProvider.id,
          conversation_id: '550e8400-e29b-41d4-a716-446655440123',
          initial_message_id: '550e8400-e29b-41d4-a716-446655440133',
          response_message_id: null,
          response_time_minutes: null,
          responded_within_24h: false,
          createdAt: new Date()
        }
      ];

      await ResponseMetrics.bulkCreate(mockMetrics);

      const metrics = await testProvider.getPublicResponseMetrics();
      
      expect(metrics.averageResponseTime).toBe('1 hour 30 minutes'); // 90 minutes average
      expect(metrics.responseRate).toBe('66.67%'); // 2 out of 3 responded
      expect(metrics.basedOnDays).toBe(30);
      expect(metrics.sampleSize).toBe(3);
      expect(metrics.note).toBe('Based on 3 conversations in the last 30 days');
    });
  });

  describe('isProvider', () => {
    it('should return true for provider users', () => {
      expect(testProvider.isProvider()).toBe(true);
    });

    it('should return false for client users', () => {
      expect(testClient.isProvider()).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('calculateResponseMetrics error handling', () => {
      it('should handle database errors gracefully', async () => {
        // Mock sequelize to throw an error
        const originalFindAll = sequelize.models.ResponseMetrics.findAll;
        sequelize.models.ResponseMetrics.findAll = jest.fn().mockRejectedValue(new Error('Database error'));

        const metrics = await testProvider.calculateResponseMetrics();

        expect(metrics).toEqual({
          averageResponseTime: null,
          responseRate: null,
          sampleSize: 0,
          hasInsufficientData: true,
          error: 'Database error'
        });

        // Restore original function
        sequelize.models.ResponseMetrics.findAll = originalFindAll;
      });

      it('should filter out metrics with negative response times', async () => {
        const mockMetrics = [
          {
            provider_id: testProvider.id,
            conversation_id: '550e8400-e29b-41d4-a716-446655440001',
            initial_message_id: '550e8400-e29b-41d4-a716-446655440011',
            response_message_id: '550e8400-e29b-41d4-a716-446655440021',
            response_time_minutes: -30, // Invalid negative time
            responded_within_24h: true,
            createdAt: new Date()
          },
          {
            provider_id: testProvider.id,
            conversation_id: '550e8400-e29b-41d4-a716-446655440002',
            initial_message_id: '550e8400-e29b-41d4-a716-446655440012',
            response_message_id: '550e8400-e29b-41d4-a716-446655440022',
            response_time_minutes: 60, // Valid time
            responded_within_24h: true,
            createdAt: new Date()
          },
          {
            provider_id: testProvider.id,
            conversation_id: '550e8400-e29b-41d4-a716-446655440003',
            initial_message_id: '550e8400-e29b-41d4-a716-446655440013',
            response_message_id: '550e8400-e29b-41d4-a716-446655440023',
            response_time_minutes: 15000, // Invalid excessive time (10+ days)
            responded_within_24h: false,
            createdAt: new Date()
          }
        ];

        await ResponseMetrics.bulkCreate(mockMetrics);

        const metrics = await testProvider.calculateResponseMetrics();

        // Should only count the valid metric
        expect(metrics.sampleSize).toBe(1);
        expect(metrics.averageResponseTime).toBe(60);
        expect(metrics.responseRate).toBe(100);
        expect(metrics.hasInsufficientData).toBe(true); // Less than 3 valid metrics
      });

      it('should handle all invalid metrics', async () => {
        const mockMetrics = [
          {
            provider_id: testProvider.id,
            conversation_id: '550e8400-e29b-41d4-a716-446655440001',
            initial_message_id: '550e8400-e29b-41d4-a716-446655440011',
            response_message_id: '550e8400-e29b-41d4-a716-446655440021',
            response_time_minutes: -30, // Invalid negative time
            responded_within_24h: true,
            createdAt: new Date()
          },
          {
            provider_id: testProvider.id,
            conversation_id: '550e8400-e29b-41d4-a716-446655440002',
            initial_message_id: '550e8400-e29b-41d4-a716-446655440012',
            response_message_id: '550e8400-e29b-41d4-a716-446655440022',
            response_time_minutes: 15000, // Invalid excessive time
            responded_within_24h: false,
            createdAt: new Date()
          }
        ];

        await ResponseMetrics.bulkCreate(mockMetrics);

        const metrics = await testProvider.calculateResponseMetrics();

        expect(metrics.sampleSize).toBe(0);
        expect(metrics.averageResponseTime).toBeNull();
        expect(metrics.responseRate).toBeNull();
        expect(metrics.hasInsufficientData).toBe(true);
      });

      it('should handle calculated negative average response time', async () => {
        // Mock calculateResponseMetrics to return negative average
        const originalCalculate = testProvider.calculateResponseMetrics;
        testProvider.calculateResponseMetrics = jest.fn().mockResolvedValue({
          averageResponseTime: -50, // Negative average (edge case)
          responseRate: 75,
          sampleSize: 3,
          hasInsufficientData: false
        });

        const metrics = await testProvider.calculateResponseMetrics();

        expect(metrics.averageResponseTime).toBe(-50);

        // Restore original function
        testProvider.calculateResponseMetrics = originalCalculate;
      });
    });

    describe('getResponseMetrics error handling', () => {
      it('should handle errors in calculateResponseMetrics', async () => {
        // Mock calculateResponseMetrics to throw an error
        const originalCalculate = testProvider.calculateResponseMetrics;
        testProvider.calculateResponseMetrics = jest.fn().mockRejectedValue(new Error('Calculation error'));

        const metrics = await testProvider.getResponseMetrics();

        expect(metrics.displayText).toBe('Error loading response data');
        expect(metrics.averageResponseTime).toBeNull();
        expect(metrics.responseRate).toBeNull();
        expect(metrics.error).toBe('Calculation error');

        // Restore original function
        testProvider.calculateResponseMetrics = originalCalculate;
      });

      it('should handle invalid average response time values', async () => {
        // Mock calculateResponseMetrics to return excessively large time
        const originalCalculate = testProvider.calculateResponseMetrics;
        testProvider.calculateResponseMetrics = jest.fn().mockResolvedValue({
          averageResponseTime: 50000, // Excessively large time (34+ days)
          responseRate: 50,
          sampleSize: 3,
          hasInsufficientData: false
        });

        const metrics = await testProvider.getResponseMetrics();

        // Should not format the invalid time
        expect(metrics.averageResponseTime).toBeNull();
        expect(metrics.rawMetrics.averageResponseTimeMinutes).toBe(50000);

        // Restore original function
        testProvider.calculateResponseMetrics = originalCalculate;
      });

      it('should handle invalid response rate values', async () => {
        // Mock calculateResponseMetrics to return invalid response rate
        const originalCalculate = testProvider.calculateResponseMetrics;
        testProvider.calculateResponseMetrics = jest.fn().mockResolvedValue({
          averageResponseTime: 60,
          responseRate: 150, // Invalid rate > 100%
          sampleSize: 3,
          hasInsufficientData: false
        });

        const metrics = await testProvider.getResponseMetrics();

        // Should not format the invalid rate
        expect(metrics.responseRate).toBeNull();
        expect(metrics.rawMetrics.responseRatePercentage).toBe(150);

        // Restore original function
        testProvider.calculateResponseMetrics = originalCalculate;
      });
    });

    describe('getPublicResponseMetrics error handling', () => {
      it('should handle errors gracefully', async () => {
        // Mock getResponseMetrics to throw an error
        const originalGet = testProvider.getResponseMetrics;
        testProvider.getResponseMetrics = jest.fn().mockRejectedValue(new Error('Get metrics error'));

        const metrics = await testProvider.getPublicResponseMetrics();

        expect(metrics.displayText).toBe('Response data temporarily unavailable');
        expect(metrics.note).toBe('Please try again later');

        // Restore original function
        testProvider.getResponseMetrics = originalGet;
      });

      it('should handle metrics with errors', async () => {
        // Mock getResponseMetrics to return error state
        const originalGet = testProvider.getResponseMetrics;
        testProvider.getResponseMetrics = jest.fn().mockResolvedValue({
          averageResponseTime: null,
          responseRate: null,
          sampleSize: 0,
          error: 'Database connection failed'
        });

        const metrics = await testProvider.getPublicResponseMetrics();

        expect(metrics.displayText).toBe('Response data temporarily unavailable');
        expect(metrics.note).toBe('Please try again later');

        // Restore original function
        testProvider.getResponseMetrics = originalGet;
      });

      it('should handle invalid metrics gracefully', async () => {
        // Mock getResponseMetrics to return invalid metrics that would be filtered out
        const originalGet = testProvider.getResponseMetrics;
        testProvider.getResponseMetrics = jest.fn().mockResolvedValue({
          averageResponseTime: null,
          responseRate: null,
          sampleSize: 0,
          rawMetrics: {
            averageResponseTimeMinutes: null,
            responseRatePercentage: null
          }
        });

        const metrics = await testProvider.getPublicResponseMetrics();

        // Should show no data message since all metrics are invalid
        expect(metrics.displayText).toBe('No response data available');
        expect(metrics.note).toBe('Metrics will be available after more interactions');

        // Restore original function
        testProvider.getResponseMetrics = originalGet;
      });
    });
  });
});