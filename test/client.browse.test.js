const request = require('supertest');
const httpStatus = require('http-status').default;
const app = require('../index');
const { User, City, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Client Browse API', () => {
  let city1, city2;
  let client1, client2, client3;
  let provider;

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

    // Create clients
    const hashedPassword = await hashPassword('password123');
    
    client1 = await User.create({
      name: 'Client One',
      email: 'client1@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: city1.id,
      active: true
    });

    client2 = await User.create({
      name: 'Client Two',
      email: 'client2@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: city1.id,
      active: true
    });

    client3 = await User.create({
      name: 'Client Three',
      email: 'client3@example.com',
      password: hashedPassword,
      role: 'client',
      city_id: city2.id,
      active: true
    });

    // Create provider
    provider = await User.create({
      name: 'Provider User',
      email: 'provider@example.com',
      password: hashedPassword,
      role: 'provider',
      city_id: city1.id,
      active: true
    });
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('GET /api/clients', () => {
    test('should get all clients with default pagination', async () => {
      const res = await request(app)
        .get('/api/clients')
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body).toHaveProperty('totalResults');
      expect(res.body.results).toHaveLength(3);
      expect(res.body.totalResults).toBe(3);
    });

    test('should filter clients by city', async () => {
      const res = await request(app)
        .get(`/api/clients?cityId=${city1.id}`)
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.totalResults).toBe(2);
      const clientIds = res.body.results.map(c => c.id);
      expect(clientIds).toContain(client1.id);
      expect(clientIds).toContain(client2.id);
    });

    test('should filter clients by name', async () => {
      const res = await request(app)
        .get('/api/clients?name=Client One')
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.totalResults).toBe(1);
      expect(res.body.results[0].id).toBe(client1.id);
    });

    test('should paginate clients correctly', async () => {
      const res = await request(app)
        .get('/api/clients?page=1&limit=2')
        .expect(httpStatus.OK);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.totalPages).toBe(2);
      expect(res.body.totalResults).toBe(3);
    });
  });

  describe('GET /api/clients/:clientId', () => {
    test('should get client profile', async () => {
      const res = await request(app)
        .get(`/api/clients/${client1.id}`)
        .expect(httpStatus.OK);

      expect(res.body.id).toBe(client1.id);
      expect(res.body.name).toBe(client1.name);
      expect(res.body.email).toBe(client1.email);
      expect(res.body.role).toBe('client');
      expect(res.body).toHaveProperty('City');
    });

    test('should return 404 for non-existent client', async () => {
      await request(app)
        .get('/api/clients/00000000-0000-0000-0000-000000000000')
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 404 for provider user', async () => {
      await request(app)
        .get(`/api/clients/${provider.id}`)
        .expect(httpStatus.NOT_FOUND);
    });
  });
});