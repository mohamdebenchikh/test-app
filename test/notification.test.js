const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../index');
const { User, Service, City, ServiceRequest, Notification } = require('../src/models');
const { userService, tokenService } = require('../src/services');
const { userOne, userTwo, admin, service, city, insertUsers, insertServices, insertCities } = require('./fixtures/db');

describe('Notification routes', () => {
  beforeAll(async () => {
    // Recreate tables to avoid foreign key constraint issues
    await require('../src/models').sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clean up data between tests
    await Notification.destroy({ where: {}, force: true });
    await ServiceRequest.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await Service.destroy({ where: {}, force: true });
    await City.destroy({ where: {}, force: true });
  });

  describe('GET /v1/notifications', () => {
    let user;
    let accessToken;

    beforeEach(async () => {
      user = await User.create(userOne);
      accessToken = await tokenService.generateAuthTokens(user);
    });

    test('should return 200 and user notifications', async () => {
      await insertServices([service]);
      await insertCities([city]);
      
      // Create a service request
      const serviceRequest = await ServiceRequest.create({
        title: 'Test Request',
        description: 'Test description',
        start_price: 100.00,
        due_date: new Date(),
        client_id: user.id,
        service_id: service.id,
        city_id: city.id
      });

      // Create a notification for the user
      await Notification.create({
        user_id: user.id,
        type: 'service_request',
        title: 'New Service Request',
        message: 'A new service request has been created',
        data: { service_request_id: serviceRequest.id },
        related_id: serviceRequest.id,
        related_type: 'service_request'
      });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${accessToken.access.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        user_id: user.id,
        type: 'service_request',
        title: 'New Service Request',
        message: 'A new service request has been created'
      });
    });
  });
});