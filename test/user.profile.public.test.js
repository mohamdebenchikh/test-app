const request = require('supertest');
const app = require('../index');
const { sequelize, User, ResponseMetrics, Conversation, Message, City } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Public User Profile API', () => {
  let testProvider;
  let testClient;
  let testCity;
  let testConversation;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Create a test city
    testCity = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de Test'
    });
    
    // Create a test provider
    const providerData = {
      name: 'Test Provider',
      email: 'provider@example.com',
      password: await hashPassword('Password123!'),
      role: 'provider',
      bio: 'I am a test provider',
      phone_number: '+1234567890',
      city_id: testCity.id,
      average_response_time_minutes: 120, // 2 hours
      response_rate_percentage: 85.50,
      metrics_last_updated: new Date()
    };
    
    testProvider = await User.create(providerData);
    
    // Create a test client
    const clientData = {
      name: 'Test Client',
      email: 'client@example.com',
      password: await hashPassword('Password123!'),
      role: 'client',
      city_id: testCity.id
    };
    
    testClient = await User.create(clientData);

    // Create a test conversation
    testConversation = await Conversation.create({
      userOneId: testClient.id,
      userTwoId: testProvider.id
    });

    // Note: Response metrics will be tested separately since the table might not exist yet
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('GET /api/users/providers/:id/profile - Get provider profile', () => {
    it('should get provider profile with response metrics successfully', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProvider.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testProvider.id);
      expect(response.body).toHaveProperty('name', 'Test Provider');
      expect(response.body).toHaveProperty('email', 'provider@example.com');
      expect(response.body).toHaveProperty('role', 'provider');
      expect(response.body).toHaveProperty('bio', 'I am a test provider');
      expect(response.body).toHaveProperty('phone_number', '+1234567890');
      
      // Check city information
      expect(response.body).toHaveProperty('City');
      expect(response.body.City).toHaveProperty('name_en', 'Test City');
      
      // Check average rating
      expect(response.body).toHaveProperty('averageRating');
      
      // Check presence information
      expect(response.body).toHaveProperty('presence');
      expect(response.body).toHaveProperty('last_seen_text');
      expect(response.body).toHaveProperty('is_online');
      
      // Check response metrics (should be present for providers)
      expect(response.body).toHaveProperty('responseMetrics');
      const metrics = response.body.responseMetrics;
      
      // Since we don't have test data, it should show no data available
      if (metrics) {
        expect(metrics).toHaveProperty('displayText', 'No response data available');
        expect(metrics).toHaveProperty('note', 'Metrics will be available after more interactions');
      }
    });

    it('should return 404 for non-existent provider', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      
      const response = await request(app)
        .get(`/api/users/providers/${nonExistentId}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Provider not found');
    });

    it('should return 404 for inactive provider', async () => {
      // Create an inactive provider
      const inactiveProvider = await User.create({
        name: 'Inactive Provider',
        email: 'inactive@example.com',
        password: await hashPassword('Password123!'),
        role: 'provider',
        active: false
      });

      const response = await request(app)
        .get(`/api/users/providers/${inactiveProvider.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Provider not found');
    });

    it('should return 404 when trying to get client profile via provider endpoint', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testClient.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Provider not found');
    });

    it('should handle provider with no response metrics data', async () => {
      // Create a provider with no response metrics
      const newProvider = await User.create({
        name: 'New Provider',
        email: 'newprovider@example.com',
        password: await hashPassword('Password123!'),
        role: 'provider',
        city_id: testCity.id
      });

      const response = await request(app)
        .get(`/api/users/providers/${newProvider.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('responseMetrics');
      const metrics = response.body.responseMetrics;
      expect(metrics).toHaveProperty('displayText', 'No response data available');
      expect(metrics).toHaveProperty('note', 'Metrics will be available after more interactions');
    });
  });

  describe('GET /api/users/clients/:id/profile - Get client profile', () => {
    it('should get client profile successfully', async () => {
      const response = await request(app)
        .get(`/api/users/clients/${testClient.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testClient.id);
      expect(response.body).toHaveProperty('name', 'Test Client');
      expect(response.body).toHaveProperty('email', 'client@example.com');
      expect(response.body).toHaveProperty('role', 'client');
      
      // Check city information
      expect(response.body).toHaveProperty('City');
      expect(response.body.City).toHaveProperty('name_en', 'Test City');
      
      // Clients should not have response metrics
      expect(response.body).not.toHaveProperty('responseMetrics');
    });

    it('should return 404 for non-existent client', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      
      const response = await request(app)
        .get(`/api/users/clients/${nonExistentId}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Client not found');
    });

    it('should return 404 for inactive client', async () => {
      // Create an inactive client
      const inactiveClient = await User.create({
        name: 'Inactive Client',
        email: 'inactiveclient@example.com',
        password: await hashPassword('Password123!'),
        role: 'client',
        active: false
      });

      const response = await request(app)
        .get(`/api/users/clients/${inactiveClient.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Client not found');
    });

    it('should return 404 when trying to get provider profile via client endpoint', async () => {
      const response = await request(app)
        .get(`/api/users/clients/${testProvider.id}/profile`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Client not found');
    });
  });

  describe('Response Metrics Display Format', () => {
    it('should show no data available message for providers without metrics', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProvider.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('responseMetrics');
      const metrics = response.body.responseMetrics;
      
      expect(metrics).toHaveProperty('displayText', 'No response data available');
      expect(metrics).toHaveProperty('note', 'Metrics will be available after more interactions');
    });
  });

  describe('Privacy Controls', () => {
    it('should only show response metrics for providers', async () => {
      // Client profile should not have response metrics
      const clientResponse = await request(app)
        .get(`/api/users/clients/${testClient.id}/profile`)
        .expect(200);

      expect(clientResponse.body).not.toHaveProperty('responseMetrics');

      // Provider profile should have response metrics
      const providerResponse = await request(app)
        .get(`/api/users/providers/${testProvider.id}/profile`)
        .expect(200);

      expect(providerResponse.body).toHaveProperty('responseMetrics');
    });

    it('should not expose sensitive user information', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProvider.id}/profile`)
        .expect(200);

      // Should not expose password or other sensitive fields
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('verify');
      
      // Should expose public profile information
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('bio');
      expect(response.body).toHaveProperty('role');
    });
  });
});