const request = require('supertest');
const httpStatus = require('http-status').default;
const app = require('../index');
const { User, Service, City, ServiceRequest, Offer, Notification, ProviderService, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Offer API', () => {
  let client;
  let provider;
  let service;
  let city;
  let serviceRequest;
  let clientToken;
  let providerToken;

  beforeAll(async () => {
    // Sync all models to ensure tables exist
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up database
    await Notification.destroy({ where: {}, force: true });
    await Offer.destroy({ where: {}, force: true });
    await ServiceRequest.destroy({ where: {}, force: true });
    await ProviderService.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await Service.destroy({ where: {}, force: true });
    await City.destroy({ where: {}, force: true });

    // Create a city
    city = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de test',
      lng: 45.0,
      lat: 25.0,
    });

    // Create a service
    service = await Service.create({
      image: 'test.jpg',
      icon: 'test-icon.jpg',
      is_featured: false,
      is_popular: false,
      color: '#FF0000',
      status: 'active',
    });

    // Create a client user
    const clientPassword = await hashPassword('password123');
    client = await User.create({
      name: 'Test Client',
      email: 'client@test.com',
      password: clientPassword,
      role: 'client',
      city_id: city.id,
    });

    // Create a provider user
    const providerPassword = await hashPassword('password123');
    provider = await User.create({
      name: 'Test Provider',
      email: 'provider@test.com',
      password: providerPassword,
      role: 'provider',
      city_id: city.id,
    });

    // Associate provider with service
    await ProviderService.create({
      user_id: provider.id,
      service_id: service.id,
    });

    // Create a service request
    serviceRequest = await ServiceRequest.create({
      title: 'Test Service Request',
      description: 'This is a test service request',
      start_price: 100.0,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      client_id: client.id,
      service_id: service.id,
      city_id: city.id,
    });

    // Login to get access tokens
    const clientRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@test.com', password: 'password123' });
    clientToken = clientRes.body.tokens.access.token;

    const providerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'provider@test.com', password: 'password123' });
    providerToken = providerRes.body.tokens.access.token;
  });

  describe('POST /api/offers', () => {
    test('should create an offer', async () => {
      const offerData = {
        service_request_id: serviceRequest.id,
        price: 150.0,
        description: 'I can complete this task efficiently',
        estimated_completion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      };

      const res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(offerData);

      expect(res.status).toBe(httpStatus.CREATED);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: expect.any(Number),
        description: offerData.description,
        status: 'pending',
      });

      // Check if notification was created for client
      const notifications = await Notification.findAll({
        where: { user_id: client.id, type: 'offer' }
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('New Offer Received');
    });

    test('should not allow provider to make duplicate offer', async () => {
      // Create first offer
      await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'First offer',
      });

      const offerData = {
        service_request_id: serviceRequest.id,
        price: 200.0,
        description: 'Second offer attempt',
      };

      const res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(offerData);

      expect(res.status).toBe(httpStatus.CONFLICT);
    });

    test('should not allow client to make offer', async () => {
      const offerData = {
        service_request_id: serviceRequest.id,
        price: 150.0,
        description: 'Client trying to make offer',
      };

      const res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(offerData);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
    });

    test('should not allow provider to make offer on own service request', async () => {
      // Create service request by provider
      const providerServiceRequest = await ServiceRequest.create({
        title: 'Provider Service Request',
        description: 'Provider own request',
        start_price: 100.0,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        client_id: provider.id,
        service_id: service.id,
        city_id: city.id,
      });

      const offerData = {
        service_request_id: providerServiceRequest.id,
        price: 150.0,
        description: 'Offer on own request',
      };

      const res = await request(app)
        .post('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`)
        .send(offerData);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /api/offers/service-request/:serviceRequestId', () => {
    test('should get offers for service request', async () => {
      // Create an offer
      await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Test offer',
      });

      const res = await request(app)
        .get(`/api/offers/service-request/${serviceRequest.id}`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: expect.any(Number),
        status: 'pending',
      });
      expect(res.body[0].provider).toMatchObject({
        id: provider.id,
        name: provider.name,
      });
    });
  });

  describe('GET /api/offers', () => {
    test('should get provider offers', async () => {
      // Create an offer
      await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Test offer',
      });

      const res = await request(app)
        .get('/api/offers')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: expect.any(Number),
        status: 'pending',
      });
    });
  });

  describe('PATCH /api/offers/:offerId', () => {
    test('should update pending offer', async () => {
      const offer = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Original offer',
      });

      const updateData = {
        price: 200.0,
        description: 'Updated offer',
      };

      const res = await request(app)
        .patch(`/api/offers/${offer.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(updateData);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body).toMatchObject({
        id: offer.id,
        price: expect.any(Number),
        description: updateData.description,
      });
    });

    test('should not update accepted offer', async () => {
      const offer = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Accepted offer',
        status: 'accepted',
      });

      const updateData = {
        price: 200.0,
      };

      const res = await request(app)
        .patch(`/api/offers/${offer.id}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send(updateData);

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('PATCH /api/offers/:offerId/accept', () => {
    test('should accept offer and reject others', async () => {
      // Create multiple offers
      const offer1 = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'First offer',
      });

      // Create another provider and offer
      const provider2Password = await hashPassword('password123');
      const provider2 = await User.create({
        name: 'Test Provider 2',
        email: 'provider2@test.com',
        password: provider2Password,
        role: 'provider',
        city_id: city.id,
      });

      const offer2 = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider2.id,
        price: 120.0,
        description: 'Second offer',
      });

      const res = await request(app)
        .patch(`/api/offers/${offer1.id}/accept`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.status).toBe('accepted');

      // Check that other offer was rejected
      const updatedOffer2 = await Offer.findByPk(offer2.id);
      expect(updatedOffer2.status).toBe('rejected');
    });

    test('should not allow non-owner to accept offer', async () => {
      const offer = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Test offer',
      });

      const res = await request(app)
        .patch(`/api/offers/${offer.id}/accept`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
    });
  });

  describe('PATCH /api/offers/:offerId/reject', () => {
    test('should reject offer', async () => {
      const offer = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Test offer',
      });

      const res = await request(app)
        .patch(`/api/offers/${offer.id}/reject`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.status).toBe('rejected');
    });
  });

  describe('DELETE /api/offers/:offerId', () => {
    test('should delete pending offer', async () => {
      const offer = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Test offer',
      });

      const res = await request(app)
        .delete(`/api/offers/${offer.id}`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(httpStatus.NO_CONTENT);

      // Verify offer was deleted
      const deletedOffer = await Offer.findByPk(offer.id);
      expect(deletedOffer).toBeNull();
    });

    test('should not delete accepted offer', async () => {
      const offer = await Offer.create({
        service_request_id: serviceRequest.id,
        provider_id: provider.id,
        price: 150.0,
        description: 'Accepted offer',
        status: 'accepted',
      });

      const res = await request(app)
        .delete(`/api/offers/${offer.id}`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });
});