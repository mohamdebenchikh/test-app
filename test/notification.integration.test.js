const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../index');
const { User, Service, City, ServiceRequest, Notification, ProviderService } = require('../src/models');
const { tokenService } = require('../src/services');

describe('Notification integration tests', () => {
  beforeAll(async () => {
    // Recreate tables to avoid foreign key constraint issues
    await require('../src/models').sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up data between tests
    await Notification.destroy({ where: {}, force: true });
    await ServiceRequest.destroy({ where: {}, force: true });
    await ProviderService.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await Service.destroy({ where: {}, force: true });
    await City.destroy({ where: {}, force: true });
  });

  describe('Service request creation notifications', () => {
    let client;
    let providerUser;
    let accessToken;
    let serviceData;
    let cityData;

    beforeEach(async () => {
      // Create users
      client = await User.create({
        name: 'Client User',
        email: 'client@example.com',
        password: 'password123',
        role: 'client'
      });
      
      providerUser = await User.create({
        name: 'Provider User',
        email: 'provider@example.com',
        password: 'password123',
        role: 'provider'
      });
      
      // Set city and service
      serviceData = await Service.create({
        image: 'test.jpg',
        icon: 'test-icon.jpg',
        is_featured: false,
        is_popular: false,
        color: '#FF0000',
        status: 'active'
      });
      
      cityData = await City.create({
        name_en: 'Test City',
        name_ar: 'مدينة اختبار',
        name_fr: 'Ville de test'
      });
      
      // Make providerUser a provider for the service
      await ProviderService.create({
        user_id: providerUser.id,
        service_id: serviceData.id
      });
      
      // Update provider user with city
      await providerUser.update({ city_id: cityData.id });
      
      accessToken = await tokenService.generateAuthTokens(client);
    });

    test('should create notifications when service request is created', async () => {
      const serviceRequestData = {
        title: 'Test Request',
        description: 'Test description',
        start_price: 100.00,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        service_id: serviceData.id,
        city_id: cityData.id
      };

      // Create service request
      const res = await request(app)
        .post('/api/service-requests')
        .set('Authorization', `Bearer ${accessToken.access.token}`)
        .send(serviceRequestData);
      
      expect(res.status).toBe(201);

      // Check if notification was created for provider
      const notifications = await Notification.findAll({
        where: { user_id: providerUser.id }
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('service_request');
      expect(notifications[0].title).toBe('New Service Request in Your Area');
      expect(notifications[0].read).toBe(false);
    });

    test('should not create notifications for providers in different cities', async () => {
      // Create another city
      const otherCity = await City.create({
        name_en: 'Other City',
        name_ar: 'مدينة أخرى',
        name_fr: 'Autre Ville'
      });
      
      // Update provider to different city
      await providerUser.update({ city_id: otherCity.id });

      const serviceRequestData = {
        title: 'Test Request',
        description: 'Test description',
        start_price: 100.00,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        service_id: serviceData.id,
        city_id: cityData.id
      };

      // Create service request
      const res = await request(app)
        .post('/api/service-requests')
        .set('Authorization', `Bearer ${accessToken.access.token}`)
        .send(serviceRequestData);
      
      expect(res.status).toBe(201);

      // Check that no notifications were created for provider in different city
      const notifications = await Notification.findAll({
        where: { user_id: providerUser.id }
      });

      expect(notifications).toHaveLength(0);
    });
  });
});