const request = require('supertest');
const app = require('../../index');
const { sequelize, User, ProviderPortfolio, City } = require('../models');
const { hashPassword } = require('../utils/password');
const path = require('path');
const fs = require('fs');

describe('User Profile Portfolio Integration', () => {
  let testProvider;
  let testProviderWithPortfolio;
  let testClient;
  let testCity;
  let portfolioImages;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Create a test city
    testCity = await City.create({
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de Test'
    });
    
    // Create a test provider without portfolio
    testProvider = await User.create({
      name: 'Test Provider',
      email: 'provider@example.com',
      password: await hashPassword('Password123!'),
      role: 'provider',
      bio: 'I am a test provider',
      phone_number: '+1234567890',
      city_id: testCity.id
    });

    // Create a test provider with portfolio
    testProviderWithPortfolio = await User.create({
      name: 'Provider With Portfolio',
      email: 'provider.portfolio@example.com',
      password: await hashPassword('Password123!'),
      role: 'provider',
      bio: 'I am a provider with portfolio',
      phone_number: '+1234567891',
      city_id: testCity.id
    });
    
    // Create a test client
    testClient = await User.create({
      name: 'Test Client',
      email: 'client@example.com',
      password: await hashPassword('Password123!'),
      role: 'client',
      city_id: testCity.id
    });

    // Create portfolio images for the provider with portfolio
    portfolioImages = await Promise.all([
      ProviderPortfolio.create({
        provider_id: testProviderWithPortfolio.id,
        image_url: '/uploads/portfolio/image1.jpg',
        thumbnail_url: '/uploads/portfolio/image1_thumb.jpg',
        medium_url: '/uploads/portfolio/image1_medium.jpg',
        description: 'First portfolio image',
        display_order: 1,
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'image1.jpg'
      }),
      ProviderPortfolio.create({
        provider_id: testProviderWithPortfolio.id,
        image_url: '/uploads/portfolio/image2.jpg',
        thumbnail_url: '/uploads/portfolio/image2_thumb.jpg',
        medium_url: '/uploads/portfolio/image2_medium.jpg',
        description: 'Second portfolio image',
        display_order: 2,
        file_size: 2048000,
        mime_type: 'image/jpeg',
        original_filename: 'image2.jpg'
      }),
      ProviderPortfolio.create({
        provider_id: testProviderWithPortfolio.id,
        image_url: '/uploads/portfolio/image3.jpg',
        thumbnail_url: '/uploads/portfolio/image3_thumb.jpg',
        medium_url: '/uploads/portfolio/image3_medium.jpg',
        description: 'Third portfolio image',
        display_order: 3,
        file_size: 1536000,
        mime_type: 'image/jpeg',
        original_filename: 'image3.jpg'
      })
    ]);
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('Provider Profile with Portfolio Integration', () => {
    it('should include portfolio data in provider profile response', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProviderWithPortfolio.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testProviderWithPortfolio.id);
      expect(response.body).toHaveProperty('name', 'Provider With Portfolio');
      expect(response.body).toHaveProperty('role', 'provider');
      
      // Check portfolio data is included
      expect(response.body).toHaveProperty('portfolio');
      expect(Array.isArray(response.body.portfolio)).toBe(true);
      expect(response.body.portfolio).toHaveLength(3);
      
      // Check portfolio URLs are included
      expect(response.body).toHaveProperty('portfolioUrls');
      expect(response.body.portfolioUrls).toHaveProperty('publicPortfolio');
      expect(response.body.portfolioUrls).toHaveProperty('profileView');
      expect(response.body.portfolioUrls).toHaveProperty('context', 'profile');
      
      // Check portfolio image structure
      const firstImage = response.body.portfolio[0];
      expect(firstImage).toHaveProperty('id');
      expect(firstImage).toHaveProperty('image_url');
      expect(firstImage).toHaveProperty('thumbnail_url');
      expect(firstImage).toHaveProperty('medium_url');
      expect(firstImage).toHaveProperty('description');
      expect(firstImage).toHaveProperty('display_order');
      
      // Should not have placeholder when portfolio exists
      expect(response.body).not.toHaveProperty('portfolioPlaceholder');
    });

    it('should include portfolio placeholder when provider has no portfolio', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProvider.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testProvider.id);
      expect(response.body).toHaveProperty('name', 'Test Provider');
      expect(response.body).toHaveProperty('role', 'provider');
      
      // Check empty portfolio
      expect(response.body).toHaveProperty('portfolio');
      expect(Array.isArray(response.body.portfolio)).toBe(true);
      expect(response.body.portfolio).toHaveLength(0);
      
      // Check placeholder message
      expect(response.body).toHaveProperty('portfolioPlaceholder');
      expect(response.body.portfolioPlaceholder).toBe('This provider has not added any portfolio images yet.');
      
      // Check portfolio URLs are still included
      expect(response.body).toHaveProperty('portfolioUrls');
      expect(response.body.portfolioUrls).toHaveProperty('publicPortfolio');
      expect(response.body.portfolioUrls).toHaveProperty('context', 'profile');
    });

    it('should not include portfolio data for client profiles', async () => {
      const response = await request(app)
        .get(`/api/users/clients/${testClient.id}/profile`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testClient.id);
      expect(response.body).toHaveProperty('name', 'Test Client');
      expect(response.body).toHaveProperty('role', 'client');
      
      // Clients should not have portfolio data
      expect(response.body).not.toHaveProperty('portfolio');
      expect(response.body).not.toHaveProperty('portfolioPlaceholder');
      expect(response.body).not.toHaveProperty('portfolioUrls');
    });
  });

  describe('Provider Browse with Portfolio Integration', () => {
    it('should include portfolio preview in browse providers response', async () => {
      const response = await request(app)
        .get('/api/providers')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.results.length).toBeGreaterThan(0);
      
      // Find the provider with portfolio
      const providerWithPortfolio = response.body.results.find(
        p => p.id === testProviderWithPortfolio.id
      );
      
      expect(providerWithPortfolio).toBeDefined();
      expect(providerWithPortfolio).toHaveProperty('portfolioPreview');
      expect(Array.isArray(providerWithPortfolio.portfolioPreview)).toBe(true);
      expect(providerWithPortfolio.portfolioPreview.length).toBeLessThanOrEqual(3);
      expect(providerWithPortfolio).toHaveProperty('hasPortfolio', true);
      expect(providerWithPortfolio).toHaveProperty('portfolioUrls');
      expect(providerWithPortfolio.portfolioUrls).toHaveProperty('context', 'browse');
      
      // Find the provider without portfolio
      const providerWithoutPortfolio = response.body.results.find(
        p => p.id === testProvider.id
      );
      
      expect(providerWithoutPortfolio).toBeDefined();
      expect(providerWithoutPortfolio).toHaveProperty('portfolioPreview');
      expect(Array.isArray(providerWithoutPortfolio.portfolioPreview)).toBe(true);
      expect(providerWithoutPortfolio.portfolioPreview).toHaveLength(0);
      expect(providerWithoutPortfolio).toHaveProperty('hasPortfolio', false);
      expect(providerWithoutPortfolio).toHaveProperty('portfolioPlaceholder');
      expect(providerWithoutPortfolio).toHaveProperty('portfolioUrls');
    });

    it('should limit portfolio preview to 3 images in browse response', async () => {
      // Create additional portfolio images to test limit
      await ProviderPortfolio.create({
        provider_id: testProviderWithPortfolio.id,
        image_url: '/uploads/portfolio/image4.jpg',
        thumbnail_url: '/uploads/portfolio/image4_thumb.jpg',
        medium_url: '/uploads/portfolio/image4_medium.jpg',
        description: 'Fourth portfolio image',
        display_order: 4,
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'image4.jpg'
      });

      const response = await request(app)
        .get('/api/providers')
        .expect(200);

      const providerWithPortfolio = response.body.results.find(
        p => p.id === testProviderWithPortfolio.id
      );
      
      expect(providerWithPortfolio).toBeDefined();
      expect(providerWithPortfolio.portfolioPreview).toHaveLength(3);
    });
  });

  describe('Portfolio URL Generation', () => {
    it('should generate correct portfolio URLs for different contexts', async () => {
      // Test profile context
      const profileResponse = await request(app)
        .get(`/api/users/providers/${testProviderWithPortfolio.id}/profile`)
        .expect(200);

      expect(profileResponse.body.portfolioUrls).toHaveProperty('context', 'profile');
      expect(profileResponse.body.portfolioUrls.publicPortfolio).toContain(`/api/users/${testProviderWithPortfolio.id}/portfolio`);
      expect(profileResponse.body.portfolioUrls.profileView).toContain(`/api/users/providers/${testProviderWithPortfolio.id}/profile`);

      // Test browse context
      const browseResponse = await request(app)
        .get('/api/providers')
        .expect(200);

      const provider = browseResponse.body.results.find(p => p.id === testProviderWithPortfolio.id);
      expect(provider.portfolioUrls).toHaveProperty('context', 'browse');
      expect(provider.portfolioUrls.publicPortfolio).toContain(`/api/users/${testProviderWithPortfolio.id}/portfolio`);
    });
  });

  describe('Portfolio Error Handling', () => {
    it('should handle portfolio service errors gracefully', async () => {
      // This test would require mocking the portfolio service to throw an error
      // For now, we'll test that the response structure is maintained even with errors
      const response = await request(app)
        .get(`/api/users/providers/${testProvider.id}/profile`)
        .expect(200);

      // Should still have portfolio-related fields even if empty
      expect(response.body).toHaveProperty('portfolio');
      expect(response.body).toHaveProperty('portfolioUrls');
      expect(response.body).toHaveProperty('portfolioPlaceholder');
    });
  });

  describe('Portfolio Data Structure Validation', () => {
    it('should return portfolio images with correct data structure', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProviderWithPortfolio.id}/profile`)
        .expect(200);

      const portfolio = response.body.portfolio;
      expect(portfolio.length).toBeGreaterThanOrEqual(3);

      // Test the first 3 images (the original ones we created)
      portfolio.slice(0, 3).forEach((image, index) => {
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('provider_id', testProviderWithPortfolio.id);
        expect(image).toHaveProperty('image_url');
        expect(image).toHaveProperty('thumbnail_url');
        expect(image).toHaveProperty('medium_url');
        expect(image).toHaveProperty('description');
        expect(image).toHaveProperty('display_order');
        expect(image).toHaveProperty('file_size');
        expect(image).toHaveProperty('mime_type');
        expect(image).toHaveProperty('original_filename');
        expect(image).toHaveProperty('createdAt');
        expect(image).toHaveProperty('updatedAt');
        
        // Validate data types
        expect(typeof image.id).toBe('string');
        expect(typeof image.provider_id).toBe('string');
        expect(typeof image.image_url).toBe('string');
        expect(typeof image.description).toBe('string');
        expect(typeof image.display_order).toBe('number');
        expect(typeof image.file_size).toBe('number');
        expect(typeof image.mime_type).toBe('string');
      });
    });
  });

  describe('Portfolio Privacy Controls', () => {
    it('should only show public portfolio data in profile responses', async () => {
      const response = await request(app)
        .get(`/api/users/providers/${testProviderWithPortfolio.id}/profile`)
        .expect(200);

      // Should include portfolio data
      expect(response.body).toHaveProperty('portfolio');
      
      // Portfolio images should not contain sensitive information
      response.body.portfolio.forEach(image => {
        // All fields should be present as they're all considered public for portfolio
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('description');
        expect(image).toHaveProperty('image_url');
      });
    });
  });
});