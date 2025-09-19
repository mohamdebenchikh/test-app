const request = require('supertest');
const httpStatus = require('http-status').default;
const app = require('../index');
const { User, Service, City, ProviderService, ServiceTranslation, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Provider Browse API', () => {
  let city1, city2;
  let service1, service2;
  let provider1, provider2, provider3;
  let client;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });

    // Create cities
    city1 = await City.create({
      name_en: 'City 1',
      name_ar: 'المدينة 1',
      name_fr: 'Ville 1'
    });

    city2 = await City.create({
      name_en: 'City 2',
      name_ar: 'المدينة 2',
      name_fr: 'Ville 2'
    });

    // Create services
    service1 = await Service.create({
      color: 'blue',
      status: 'active'
    });

    service2 = await Service.create({
      color: 'red',
      status: 'active'
    });

    // Create service translations
    await ServiceTranslation.create({
      service_id: service1.id,
      language: 'en',
      title: 'Service 1',
      description: 'Description for Service 1'
    });

    await ServiceTranslation.create({
      service_id: service1.id,
      language: 'ar',
      title: 'الخدمة 1',
      description: 'وصف للخدمة 1'
    });

    await ServiceTranslation.create({
      service_id: service2.id,
      language: 'en',
      title: 'Service 2',
      description: 'Description for Service 2'
    });

    // Create providers
    const hashedPassword = await hashPassword('password123');
    
    provider1 = await User.create({
      name: 'Provider One',
      email: 'provider1@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: city1.id,
      active: true
    });

    provider2 = await User.create({
      name: 'Provider Two',
      email: 'provider2@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: city1.id,
      active: true
    });

    provider3 = await User.create({
      name: 'Provider Three',
      email: 'provider3@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: city2.id,
      active: true
    });

    // Create client
    client = await User.create({
      name: 'Client User',
      email: 'client@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: city1.id,
      active: true
    });

    // Associate providers with services
    await ProviderService.create({
      user_id: provider1.id,
      service_id: service1.id
    });

    await ProviderService.create({
      user_id: provider2.id,
      service_id: service1.id
    });

    await ProviderService.create({
      user_id: provider2.id,
      service_id: service2.id
    });

    await ProviderService.create({
      user_id: provider3.id,
      service_id: service2.id
    });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('GET /api/providers', () => {
    test('should get all providers with default pagination', async () => {
      const res = await request(app)
        .get('/api/providers')
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body).toHaveProperty('totalResults');
      expect(res.body.results).toHaveLength(3);
      expect(res.body.totalResults).toBe(3);
    });

    test('should filter providers by service', async () => {
      const res = await request(app)
        .get(`/api/providers?serviceId=${service1.id}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.totalResults).toBe(2);
      const providerIds = res.body.results.map(p => p.id);
      expect(providerIds).toContain(provider1.id);
      expect(providerIds).toContain(provider2.id);
    });

    test('should filter providers by city', async () => {
      const res = await request(app)
        .get(`/api/providers?cityId=${city1.id}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.totalResults).toBe(2);
      const providerIds = res.body.results.map(p => p.id);
      expect(providerIds).toContain(provider1.id);
      expect(providerIds).toContain(provider2.id);
    });

    test('should filter providers by name', async () => {
      const res = await request(app)
        .get('/api/providers?name=Provider One')
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.totalResults).toBe(1);
      expect(res.body.results[0].id).toBe(provider1.id);
    });

    test('should paginate providers correctly', async () => {
      const res = await request(app)
        .get('/api/providers?page=1&limit=2')
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.totalPages).toBe(2);
      expect(res.body.totalResults).toBe(3);
    });

    test('should combine multiple filters', async () => {
      const res = await request(app)
        .get(`/api/providers?serviceId=${service1.id}&cityId=${city1.id}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.totalResults).toBe(2);
    });
  });

  describe('GET /api/providers/:providerId', () => {
    test('should get provider profile with services', async () => {
      const res = await request(app)
        .get(`/api/providers/${provider2.id}`)
        .expect(httpStatus.OK);

      expect(res.body.id).toBe(provider2.id);
      expect(res.body.name).toBe(provider2.name);
      expect(res.body.email).toBe(provider2.email);
      expect(res.body.role).toBe('provider');
      expect(res.body).toHaveProperty('Services');
      expect(res.body).toHaveProperty('City');
      expect(res.body.Services).toHaveLength(2);
    });

    test('should return 404 for non-existent provider', async () => {
      await request(app)
        .get('/api/providers/00000000-0000-0000-0000-000000000000')
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 404 for client user', async () => {
      await request(app)
        .get(`/api/providers/${client.id}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });
});