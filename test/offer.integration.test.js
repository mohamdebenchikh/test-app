const request = require('supertest');
const app = require('../index');
const { User, Service, City, ServiceRequest, Offer, Notification, ProviderService, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Offer Integration Tests', () => {
  let client;
  let provider;
  let service;
  let city;
  let serviceRequest;
  let clientToken;
  let providerToken;

  beforeAll(async () => {
    // Recreate tables to avoid foreign key constraint issues
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up data between tests
    await Notification.destroy({ where: {}, force: true });
    await Offer.destroy({ where: {}, force: true });
    await ServiceRequest.destroy({ where: {}, force: true });
    await ProviderService.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await Service.destroy({ where: {}, force: true });
    await City.destroy({ where: {}, force: true });

    // Create test data
    city = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de test',
      lng: 45.0,
      lat: 25.0,
    });

    service = await Service.create({
      image: 'test.jpg',
      icon: 'test-icon.jpg',
      is_featured: false,
      is_popular: false,
      color: '#FF0000',
      status: 'active',
    });

    const clientPassword = await hashPassword('password123');
    client = await User.create({
      name: 'Test Client',
      email: 'client@test.com',
      password: clientPassword,
      role: 'client',
      city_id: city.id,
    });

    const providerPassword = await hashPassword('password123');
    provider = await User.create({
      name: 'Test Provider',
      email: 'provider@test.com',
      password: providerPassword,
      role: 'provider',
      city_id: city.id,
    });

    await ProviderService.create({
      user_id: provider.id,
      service_id: service.id,
    });

    serviceRequest = await ServiceRequest.create({
      title: 'Test Service Request',
      description: 'This is a test service request',
      start_price: 100.0,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      client_id: client.id,
      service_id: service.id,
      city_id: city.id,
    });

    // Get tokens
    const clientRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@test.com', password: 'password123' });
    clientToken = clientRes.body.tokens.access.token;

    const providerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'provider@test.com', password: 'password123' });
    providerToken = providerRes.body.tokens.access.token;
  });

  describe('Offer notification workflow', () => {
    test('should create notification when offer is made', async () => {
      const offerData = {
        service_request_id: serviceRequest.id,
        price: 150.0,
        description: 'I can complete this task efficiently',
      };

      // Create offer
      const res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(offerData);

      expect(res.status).toBe(201);

      // Check if notification was created for client
      const notifications = await Notification.findAll({
        where: { user_id: client.id, type: 'offer' }
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        user_id: client.id,
        type: 'offer',
        title: 'New Offer Received',
        read: false,
      });
      expect(notifications[0].message).toContain('Test Provider');
      expect(notifications[0].message).toContain('$150');
      expect(notifications[0].data.offer_id).toBe(res.body.id);
    });

    test('should handle multiple offers from different providers', async () => {
      // Create second provider
      const provider2Password = await hashPassword('password123');
      const provider2 = await User.create({
        name: 'Test Provider 2',
        email: 'provider2@test.com',
        password: provider2Password,
        role: 'provider',
        city_id: city.id,
      });

      await ProviderService.create({
        user_id: provider2.id,
        service_id: service.id,
      });

      const provider2Res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'provider2@test.com', password: 'password123' });
      const provider2Token = provider2Res.body.tokens.access.token;

      // First offer
      await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 150.0,
          description: 'First offer',
        });

      // Second offer
      await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${provider2Token}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 120.0,
          description: 'Second offer',
        });

      // Check notifications
      const notifications = await Notification.findAll({
        where: { user_id: client.id, type: 'offer' },
        order: [['createdAt', 'ASC']]
      });

      expect(notifications).toHaveLength(2);
      expect(notifications[0].message).toContain('Test Provider');
      expect(notifications[1].message).toContain('Test Provider 2');
    });

    test('should get client notifications via API', async () => {
      // Create offer to generate notification
      await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 150.0,
          description: 'Test offer',
        });

      // Get notifications via API
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      
      const offerNotifications = res.body.filter(n => n.type === 'offer');
      expect(offerNotifications).toHaveLength(1);
      expect(offerNotifications[0].title).toBe('New Offer Received');
    });

    test('should complete offer acceptance workflow', async () => {
      // Create offer
      const offerRes = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 150.0,
          description: 'Test offer',
        });

      const offerId = offerRes.body.id;

      // Client gets offers for their service request
      const offersRes = await request(app)
        .get(`/api/offers/service-request/${serviceRequest.id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(offersRes.status).toBe(200);
      expect(offersRes.body).toHaveLength(1);
      expect(offersRes.body[0].status).toBe('pending');

      // Client accepts the offer
      const acceptRes = await request(app)
        .patch(`/api/offers/${offerId}/accept`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.status).toBe('accepted');

      // Verify offer status in database
      const updatedOffer = await Offer.findByPk(offerId);
      expect(updatedOffer.status).toBe('accepted');
    });
  });

  describe('Offer business logic validation', () => {
    test('should prevent duplicate offers from same provider', async () => {
      // First offer
      await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 150.0,
          description: 'First offer',
        });

      // Attempt duplicate offer
      const res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 200.0,
          description: 'Duplicate offer attempt',
        });

      expect(res.status).toBe(409); // Conflict
    });

    test('should prevent updating accepted offers', async () => {
      // Create and accept offer
      const offerRes = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 150.0,
          description: 'Test offer',
        });

      await request(app)
        .patch(`/api/offers/${offerRes.body.id}/accept`)
        .set('Authorization', `Bearer ${clientToken}`);

      // Attempt to update accepted offer
      const updateRes = await request(app)
        .patch(`/api/offers/${offerRes.body.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          price: 200.0,
        });

      expect(updateRes.status).toBe(400); // Bad Request
    });

    test('should auto-reject other offers when one is accepted', async () => {
      // Create second provider
      const provider2Password = await hashPassword('password123');
      const provider2 = await User.create({
        name: 'Test Provider 2',
        email: 'provider2@test.com',
        password: provider2Password,
        role: 'provider',
        city_id: city.id,
      });

      await ProviderService.create({
        user_id: provider2.id,
        service_id: service.id,
      });

      const provider2Res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'provider2@test.com', password: 'password123' });
      const provider2Token = provider2Res.body.tokens.access.token;

      // Create two offers
      const offer1Res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 150.0,
          description: 'First offer',
        });

      const offer2Res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${provider2Token}`)
        .send({
          service_request_id: serviceRequest.id,
          price: 120.0,
          description: 'Second offer',
        });

      // Accept first offer
      await request(app)
        .patch(`/api/offers/${offer1Res.body.id}/accept`)
        .set('Authorization', `Bearer ${clientToken}`);

      // Check that second offer was auto-rejected
      const offer2 = await Offer.findByPk(offer2Res.body.id);
      expect(offer2.status).toBe('rejected');
    });
  });
});