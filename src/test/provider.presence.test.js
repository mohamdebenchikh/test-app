const request = require('supertest');
const app = require('../../index');
const { sequelize, User, UserSession, City, Service, ProviderService } = require('../models');
const { hashPassword } = require('../utils/password');
const presenceService = require('../services/presence.service');

describe('Provider Presence Filtering', () => {
  let testCity, testService;
  let onlineProvider, offlineProvider, awayProvider;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test city
    testCity = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de Test'
    });

    // Create test service
    testService = await Service.create({
      image: 'test-service.jpg',
      icon: 'test-icon.svg'
    });

    // Create test providers
    const hashedPassword = await hashPassword('password123');
    
    onlineProvider = await User.create({
      name: 'Online Provider',
      email: 'online@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id
    });

    offlineProvider = await User.create({
      name: 'Offline Provider',
      email: 'offline@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id
    });

    awayProvider = await User.create({
      name: 'Away Provider',
      email: 'away@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: testCity.id
    });

    // Associate providers with service
    await ProviderService.bulkCreate([
      { user_id: onlineProvider.id, service_id: testService.id },
      { user_id: offlineProvider.id, service_id: testService.id },
      { user_id: awayProvider.id, service_id: testService.id }
    ]);

    // Set up presence states
    await presenceService.setUserOnline(onlineProvider.id, 'socket-1');
    await presenceService.setCustomStatus(awayProvider.id, 'away', 'In a meeting');
    
    // Set offline provider's last activity to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await User.update(
      { 
        online_status: 'offline',
        last_activity: twoHoursAgo
      },
      { where: { id: offlineProvider.id } }
    );
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up sessions before each test
    await UserSession.destroy({ where: {}, force: true });
  });

  describe('GET /api/providers with presence filters', () => {
    test('should filter providers by online status', async () => {
      const response = await request(app)
        .get('/api/providers?online_status=online')
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      // All returned providers should be online
      response.body.results.forEach(provider => {
        expect(provider.online_status).toBe('online');
        expect(provider.presence).toBeTruthy();
        expect(provider.is_online).toBe(true);
      });
    });

    test('should filter providers by away status', async () => {
      const response = await request(app)
        .get('/api/providers?online_status=away')
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      
      // All returned providers should be away
      response.body.results.forEach(provider => {
        expect(provider.online_status).toBe('away');
        expect(provider.presence).toBeTruthy();
      });
    });

    test('should filter providers active within last hour', async () => {
      // Set one provider as active within last hour
      await presenceService.updateLastActivity(onlineProvider.id);
      
      const response = await request(app)
        .get('/api/providers?active_within=1h')
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      // Check that returned providers have recent activity or are online
      response.body.results.forEach(provider => {
        const hasRecentActivity = provider.last_activity && 
          new Date(provider.last_activity) > new Date(Date.now() - 60 * 60 * 1000);
        const isOnline = provider.online_status === 'online';
        expect(hasRecentActivity || isOnline).toBe(true);
      });
    });

    test('should filter providers by last seen within timeframe', async () => {
      const response = await request(app)
        .get('/api/providers?last_seen=3h')
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      
      // All returned providers should have been active within 3 hours
      response.body.results.forEach(provider => {
        if (provider.last_activity) {
          const lastActivity = new Date(provider.last_activity);
          const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
          expect(lastActivity.getTime()).toBeGreaterThan(threeHoursAgo.getTime());
        }
      });
    });

    test('should combine presence filters with other filters', async () => {
      const response = await request(app)
        .get(`/api/providers?online_status=online&cityId=${testCity.id}&serviceId=${testService.id}`)
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      
      // Check that all filters are applied
      response.body.results.forEach(provider => {
        expect(provider.online_status).toBe('online');
        expect(provider.city_id).toBe(testCity.id);
        // Should have the service (through ProviderService association)
      });
    });

    test('should return providers ordered by presence (online first)', async () => {
      const response = await request(app)
        .get('/api/providers')
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBeGreaterThan(1);
      
      // Check that online providers come first
      let foundOffline = false;
      response.body.results.forEach(provider => {
        if (foundOffline && provider.online_status === 'online') {
          // This would mean an online provider came after an offline one
          fail('Online providers should come before offline providers');
        }
        if (provider.online_status === 'offline') {
          foundOffline = true;
        }
      });
    });

    test('should include presence information in response', async () => {
      const response = await request(app)
        .get('/api/providers')
        .expect(200);

      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      // Check that presence information is included
      response.body.results.forEach(provider => {
        expect(provider).toHaveProperty('presence');
        expect(provider).toHaveProperty('last_seen_text');
        expect(provider).toHaveProperty('is_online');
        expect(provider).toHaveProperty('online_status');
        
        // Validate presence object structure
        expect(provider.presence).toHaveProperty('userId');
        expect(provider.presence).toHaveProperty('online_status');
        expect(provider.presence).toHaveProperty('show_status');
      });
    });

    test('should return 400 for invalid time format', async () => {
      await request(app)
        .get('/api/providers?last_seen=invalid')
        .expect(400);
    });

    test('should return 400 for invalid online_status', async () => {
      await request(app)
        .get('/api/providers?online_status=invalid')
        .expect(400);
    });
  });

  describe('GET /api/providers/:providerId with presence', () => {
    test('should include presence information in provider profile', async () => {
      const response = await request(app)
        .get(`/api/providers/${onlineProvider.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('presence');
      expect(response.body).toHaveProperty('last_seen_text');
      expect(response.body).toHaveProperty('is_online');
      expect(response.body).toHaveProperty('online_status');
      
      // Validate presence information
      expect(response.body.presence.userId).toBe(onlineProvider.id);
      expect(response.body.online_status).toBe('online');
      expect(response.body.is_online).toBe(true);
    });

    test('should show away status and custom message', async () => {
      const response = await request(app)
        .get(`/api/providers/${awayProvider.id}`)
        .expect(200);

      expect(response.body.online_status).toBe('away');
      expect(response.body.custom_status_message).toBe('In a meeting');
      expect(response.body.presence.custom_message).toBe('In a meeting');
    });
  });
});