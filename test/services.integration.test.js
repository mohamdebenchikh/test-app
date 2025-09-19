const request = require('supertest');
const app = require('../index');
const { sequelize, Service } = require('../src/models');

describe('Services API', () => {
  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Seed some test data
    await Service.bulkCreate([
      {
        image: 'https://example.com/plumbing.jpg',
        icon: 'https://example.com/plumbing-icon.png',
        is_featured: true,
        is_popular: true,
        color: '#FF5733',
        status: 'active'
      },
      {
        image: 'https://example.com/electrical.jpg',
        icon: 'https://example.com/electrical-icon.png',
        is_featured: false,
        is_popular: true,
        color: '#33FF57',
        status: 'active'
      },
      {
        image: 'https://example.com/cleaning.jpg',
        icon: 'https://example.com/cleaning-icon.png',
        is_featured: false,
        is_popular: false,
        color: '#3357FF',
        status: 'inactive'
      }
    ]);
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('GET /api/services', () => {
    it('should return all services', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      
      // Check that each service has the expected properties
      response.body.forEach(service => {
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('image');
        expect(service).toHaveProperty('icon');
        expect(service).toHaveProperty('is_featured');
        expect(service).toHaveProperty('is_popular');
        expect(service).toHaveProperty('color');
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('createdAt');
        expect(service).toHaveProperty('updatedAt');
      });
      
      // Check specific service data
      const plumbing = response.body.find(service => service.image.includes('plumbing'));
      expect(plumbing).toBeDefined();
      expect(plumbing.is_featured).toBe(true);
      expect(plumbing.is_popular).toBe(true);
      expect(plumbing.color).toBe('#FF5733');
      expect(plumbing.status).toBe('active');
    });

    it('should return services with correct boolean values', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);

      const plumbing = response.body.find(service => service.image.includes('plumbing'));
      const electrical = response.body.find(service => service.image.includes('electrical'));
      const cleaning = response.body.find(service => service.image.includes('cleaning'));

      expect(plumbing.is_featured).toBe(true);
      expect(plumbing.is_popular).toBe(true);
      
      expect(electrical.is_featured).toBe(false);
      expect(electrical.is_popular).toBe(true);
      
      expect(cleaning.is_featured).toBe(false);
      expect(cleaning.is_popular).toBe(false);
    });

    it('should return services with correct status values', async () => {
      const response = await request(app)
        .get('/api/services')
        .expect(200);

      const activeServices = response.body.filter(service => service.status === 'active');
      const inactiveServices = response.body.filter(service => service.status === 'inactive');

      expect(activeServices.length).toBe(2);
      expect(inactiveServices.length).toBe(1);
    });
  });
});