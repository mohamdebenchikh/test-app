const request = require('supertest');
const app = require('../index');
const { sequelize, City } = require('../src/models');

describe('Cities API', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Seed some test data
    await City.bulkCreate([
      {
        name_en: 'New York',
        name_ar: 'نيويورك',
        name_fr: 'New York',
        lng: -74.0059,
        lat: 40.7128
      },
      {
        name_en: 'London',
        name_ar: 'لندن',
        name_fr: 'Londres',
        lng: -0.1257,
        lat: 51.5085
      },
      {
        name_en: 'Tokyo',
        name_ar: 'طوكيو',
        name_fr: 'Tokyo',
        lng: 139.6917,
        lat: 35.6895
      }
    ]);
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('GET /api/cities', () => {
    it('should return all cities', async () => {
      const response = await request(app)
        .get('/api/cities')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      
      // Check that each city has the expected properties
      response.body.forEach(city => {
        expect(city).toHaveProperty('id');
        expect(city).toHaveProperty('name_en');
        expect(city).toHaveProperty('name_ar');
        expect(city).toHaveProperty('name_fr');
        expect(city).toHaveProperty('lng');
        expect(city).toHaveProperty('lat');
        expect(city).toHaveProperty('createdAt');
        expect(city).toHaveProperty('updatedAt');
      });
      
      // Check specific city data
      const newYork = response.body.find(city => city.name_en === 'New York');
      expect(newYork).toBeDefined();
      expect(newYork.name_ar).toBe('نيويورك');
      expect(newYork.name_fr).toBe('New York');
      expect(newYork.lng).toBe(-74.0059);
      expect(newYork.lat).toBe(40.7128);
    });

    it('should return cities in the correct order', async () => {
      const response = await request(app)
        .get('/api/cities')
        .expect(200);

      // Check that we get cities in the order they were created
      expect(response.body[0].name_en).toBe('New York');
      expect(response.body[1].name_en).toBe('London');
      expect(response.body[2].name_en).toBe('Tokyo');
    });
  });
});