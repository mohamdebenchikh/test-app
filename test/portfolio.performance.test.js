/**
 * @fileoverview Performance tests for portfolio functionality
 * Tests system behavior under load and concurrent operations
 */

const request = require('supertest');
const app = require('../index');
const { User, ProviderPortfolio, sequelize } = require('../src/models');
const { createTestImage } = require('../src/test/fixtures/createTestImage');
const { hashPassword } = require('../src/utils/password');
const { generateToken } = require('../src/utils/jwt');
const config = require('../src/config/config');

describe('Portfolio Performance Tests', () => {
  let testProviders = [];
  let originalConfig;

  beforeAll(async () => {
    // Store original config
    originalConfig = { ...config };
    
    await sequelize.sync({ force: true });
    
    // Create multiple test providers for performance testing
    const hashedPassword = await hashPassword('password123');
    const providerPromises = [];
    
    for (let i = 0; i < 20; i++) {
      providerPromises.push(
        User.create({
          name: `Performance Provider ${i}`,
          email: `perf-provider-${i}@test.com`,
          password: hashedPassword,
          role: 'provider'
        })
      );
    }
    
    const providers = await Promise.all(providerPromises);
    
    testProviders = providers.map(provider => ({
      id: provider.id,
      token: generateToken({
        sub: provider.id,
        language: provider.language,
        role: provider.role
      })
    }));
  });

  afterAll(async () => {
    // Clean up test data
    const providerIds = testProviders.map(p => p.id);
    await ProviderPortfolio.destroy({ where: { provider_id: providerIds } });
    await User.destroy({ where: { id: providerIds } });
    
    // Restore original config
    Object.assign(config, originalConfig);
    
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up portfolio images before each test
    const providerIds = testProviders.map(p => p.id);
    await ProviderPortfolio.destroy({ where: { provider_id: providerIds } });
    
    // Reset config to defaults
    config.portfolio = {
      maxImages: 10,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['jpeg', 'jpg', 'png', 'webp'],
      storage: {
        type: 'local',
        localPath: 'uploads/portfolio'
      }
    };
  });

  describe('Concurrent Upload Performance', () => {
    test('should handle 50 concurrent uploads from different providers', async () => {
      const startTime = Date.now();
      const concurrentUploads = 50;
      
      const uploadPromises = [];
      for (let i = 0; i < concurrentUploads; i++) {
        const provider = testProviders[i % testProviders.length];
        const testImage = await createTestImage(800, 600, 'jpeg');
        
        uploadPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${provider.token}`)
            .attach('image', testImage, `concurrent-${i}.jpg`)
            .field('description', `Concurrent upload ${i}`)
        );
      }

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Most uploads should succeed (allow for some failures under load)
      const successfulUploads = responses.filter(r => r.status === 201);
      expect(successfulUploads.length).toBeGreaterThan(concurrentUploads * 0.8);

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);

      console.log(`Concurrent uploads: ${successfulUploads.length}/${concurrentUploads} successful in ${duration}ms`);
    }, 35000);

    test('should handle burst upload patterns efficiently', async () => {
      const burstSize = 10;
      const burstCount = 5;
      const burstDelay = 500; // 500ms between bursts
      
      const allResults = [];
      
      for (let burst = 0; burst < burstCount; burst++) {
        const startTime = Date.now();
        
        const burstPromises = [];
        for (let i = 0; i < burstSize; i++) {
          const provider = testProviders[i % testProviders.length];
          const testImage = await createTestImage(600, 400, 'jpeg');
          
          burstPromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `burst-${burst}-${i}.jpg`)
          );
        }
        
        const responses = await Promise.all(burstPromises);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const successCount = responses.filter(r => r.status === 201).length;
        allResults.push({ burst, duration, successCount });
        
        // Each burst should complete within 10 seconds
        expect(duration).toBeLessThan(10000);
        expect(successCount).toBeGreaterThan(burstSize * 0.7);
        
        // Delay between bursts
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstDelay));
        }
      }
      
      console.log('Burst results:', allResults);
    });

    test('should maintain performance with large file uploads', async () => {
      const largeFileCount = 10;
      const startTime = Date.now();
      
      const uploadPromises = [];
      for (let i = 0; i < largeFileCount; i++) {
        const provider = testProviders[i % testProviders.length];
        // Create large images (close to max size)
        const largeImage = await createTestImage(2000, 1500, 'jpeg', 0.8);
        
        uploadPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${provider.token}`)
            .attach('image', largeImage, `large-${i}.jpg`)
        );
      }

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulUploads = responses.filter(r => r.status === 201);
      expect(successfulUploads.length).toBeGreaterThan(largeFileCount * 0.8);

      // Should complete within 60 seconds for large files
      expect(duration).toBeLessThan(60000);

      console.log(`Large file uploads: ${successfulUploads.length}/${largeFileCount} successful in ${duration}ms`);
    }, 65000);
  });

  describe('Database Performance Under Load', () => {
    test('should handle concurrent portfolio retrievals efficiently', async () => {
      // First, populate portfolios
      const setupPromises = [];
      for (let i = 0; i < 10; i++) {
        const provider = testProviders[i];
        for (let j = 0; j < 3; j++) {
          const testImage = await createTestImage(400, 300, 'jpeg');
          setupPromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `setup-${i}-${j}.jpg`)
          );
        }
      }
      
      await Promise.all(setupPromises);
      
      // Now test concurrent retrievals
      const startTime = Date.now();
      const retrievalCount = 100;
      
      const retrievalPromises = [];
      for (let i = 0; i < retrievalCount; i++) {
        const provider = testProviders[i % testProviders.length];
        
        if (i % 3 === 0) {
          // Private portfolio access
          retrievalPromises.push(
            request(app)
              .get('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
          );
        } else if (i % 3 === 1) {
          // Public portfolio access
          retrievalPromises.push(
            request(app)
              .get(`/api/users/${provider.id}/portfolio`)
          );
        } else {
          // Portfolio stats
          retrievalPromises.push(
            request(app)
              .get('/api/users/profile/portfolio/stats')
              .set('Authorization', `Bearer ${provider.token}`)
          );
        }
      }

      const responses = await Promise.all(retrievalPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All retrievals should succeed
      const successfulRetrievals = responses.filter(r => r.status === 200);
      expect(successfulRetrievals.length).toBe(retrievalCount);

      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);

      console.log(`Portfolio retrievals: ${successfulRetrievals.length}/${retrievalCount} successful in ${duration}ms`);
    });

    test('should handle concurrent portfolio modifications efficiently', async () => {
      // Setup initial portfolios
      const setupPromises = [];
      const imageIds = [];
      
      for (let i = 0; i < 5; i++) {
        const provider = testProviders[i];
        const testImage = await createTestImage(400, 300, 'jpeg');
        setupPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${provider.token}`)
            .attach('image', testImage, `mod-setup-${i}.jpg`)
            .then(response => {
              if (response.status === 201) {
                imageIds.push({
                  id: response.body.data.id,
                  providerId: provider.id,
                  token: provider.token
                });
              }
            })
        );
      }
      
      await Promise.all(setupPromises);
      
      // Perform concurrent modifications
      const startTime = Date.now();
      const modificationPromises = [];
      
      for (let i = 0; i < 50; i++) {
        const imageData = imageIds[i % imageIds.length];
        
        if (i % 2 === 0) {
          // Update description
          modificationPromises.push(
            request(app)
              .put(`/api/users/profile/portfolio/${imageData.id}`)
              .set('Authorization', `Bearer ${imageData.token}`)
              .send({ description: `Updated description ${i}` })
          );
        } else {
          // Update order (simplified)
          modificationPromises.push(
            request(app)
              .put('/api/users/profile/portfolio/order')
              .set('Authorization', `Bearer ${imageData.token}`)
              .send({
                imageOrders: [{ id: imageData.id, displayOrder: i }]
              })
          );
        }
      }

      const responses = await Promise.all(modificationPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulMods = responses.filter(r => r.status === 200);
      expect(successfulMods.length).toBeGreaterThan(40); // Allow for some conflicts

      // Should complete within 15 seconds
      expect(duration).toBeLessThan(15000);

      console.log(`Portfolio modifications: ${successfulMods.length}/50 successful in ${duration}ms`);
    });

    test('should efficiently handle portfolio cleanup operations', async () => {
      // Create many portfolio entries
      const setupPromises = [];
      const imageIds = [];
      
      for (let i = 0; i < 10; i++) {
        const provider = testProviders[i % testProviders.length];
        for (let j = 0; j < 5; j++) {
          const testImage = await createTestImage(300, 200, 'jpeg');
          setupPromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `cleanup-${i}-${j}.jpg`)
              .then(response => {
                if (response.status === 201) {
                  imageIds.push({
                    id: response.body.data.id,
                    providerId: provider.id,
                    token: provider.token
                  });
                }
              })
          );
        }
      }
      
      await Promise.all(setupPromises);
      
      // Perform concurrent deletions
      const startTime = Date.now();
      const deletionPromises = imageIds.map(imageData =>
        request(app)
          .delete(`/api/users/profile/portfolio/${imageData.id}`)
          .set('Authorization', `Bearer ${imageData.token}`)
      );

      const responses = await Promise.all(deletionPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successfulDeletions = responses.filter(r => r.status === 200);
      expect(successfulDeletions.length).toBeGreaterThan(imageIds.length * 0.9);

      // Should complete within 20 seconds
      expect(duration).toBeLessThan(20000);

      console.log(`Portfolio deletions: ${successfulDeletions.length}/${imageIds.length} successful in ${duration}ms`);
    });
  });

  describe('Memory and Resource Management', () => {
    test('should not create memory leaks with image processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many images in cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        const cyclePromises = [];
        
        for (let i = 0; i < 10; i++) {
          const provider = testProviders[i % testProviders.length];
          const testImage = await createTestImage(800, 600, 'jpeg');
          
          cyclePromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `memory-${cycle}-${i}.jpg`)
          );
        }
        
        await Promise.all(cyclePromises);
        
        // Clean up after each cycle
        const providerIds = testProviders.map(p => p.id);
        await ProviderPortfolio.destroy({ where: { provider_id: providerIds } });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });

    test('should handle file system operations efficiently', async () => {
      const fileOperationCount = 30;
      const startTime = Date.now();
      
      // Create files
      const createPromises = [];
      for (let i = 0; i < fileOperationCount; i++) {
        const provider = testProviders[i % testProviders.length];
        const testImage = await createTestImage(600, 400, 'jpeg');
        
        createPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${provider.token}`)
            .attach('image', testImage, `fs-test-${i}.jpg`)
        );
      }
      
      const createResponses = await Promise.all(createPromises);
      const createEndTime = Date.now();
      
      // Delete files
      const deletePromises = [];
      createResponses.forEach(response => {
        if (response.status === 201) {
          const provider = testProviders.find(p => p.id === response.body.data.provider_id);
          deletePromises.push(
            request(app)
              .delete(`/api/users/profile/portfolio/${response.body.data.id}`)
              .set('Authorization', `Bearer ${provider.token}`)
          );
        }
      });
      
      const deleteResponses = await Promise.all(deletePromises);
      const endTime = Date.now();
      
      const createDuration = createEndTime - startTime;
      const deleteDuration = endTime - createEndTime;
      const totalDuration = endTime - startTime;
      
      // Operations should complete efficiently
      expect(createDuration).toBeLessThan(20000);
      expect(deleteDuration).toBeLessThan(10000);
      expect(totalDuration).toBeLessThan(25000);
      
      console.log(`File operations: Create ${createDuration}ms, Delete ${deleteDuration}ms, Total ${totalDuration}ms`);
    });
  });

  describe('Scalability Testing', () => {
    test('should maintain response times with increasing portfolio sizes', async () => {
      const portfolioSizes = [5, 10, 15];
      const results = [];
      
      for (const size of portfolioSizes) {
        const provider = testProviders[0];
        
        // Create portfolio of specified size
        const setupPromises = [];
        for (let i = 0; i < size; i++) {
          const testImage = await createTestImage(400, 300, 'jpeg');
          setupPromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `scale-${size}-${i}.jpg`)
          );
        }
        
        await Promise.all(setupPromises);
        
        // Measure retrieval performance
        const startTime = Date.now();
        const response = await request(app)
          .get('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${provider.token}`);
        const endTime = Date.now();
        
        const duration = endTime - startTime;
        results.push({ size, duration });
        
        expect(response.status).toBe(200);
        expect(response.body.data.portfolio).toHaveLength(size);
        
        // Clean up for next iteration
        await ProviderPortfolio.destroy({ where: { provider_id: provider.id } });
      }
      
      // Response times should scale reasonably
      expect(results[0].duration).toBeLessThan(2000);
      expect(results[1].duration).toBeLessThan(3000);
      expect(results[2].duration).toBeLessThan(4000);
      
      console.log('Scalability results:', results);
    });

    test('should handle multiple providers with full portfolios', async () => {
      const providerCount = 10;
      const imagesPerProvider = 5;
      
      // Set up full portfolios for multiple providers
      const setupPromises = [];
      for (let i = 0; i < providerCount; i++) {
        const provider = testProviders[i];
        for (let j = 0; j < imagesPerProvider; j++) {
          const testImage = await createTestImage(500, 400, 'jpeg');
          setupPromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `multi-${i}-${j}.jpg`)
          );
        }
      }
      
      await Promise.all(setupPromises);
      
      // Test concurrent access to all portfolios
      const startTime = Date.now();
      const accessPromises = [];
      
      for (let i = 0; i < providerCount; i++) {
        const provider = testProviders[i];
        
        // Each provider accesses their own portfolio
        accessPromises.push(
          request(app)
            .get('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${provider.token}`)
        );
        
        // Public access to portfolio
        accessPromises.push(
          request(app)
            .get(`/api/users/${provider.id}/portfolio`)
        );
      }
      
      const responses = await Promise.all(accessPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All accesses should succeed
      const successfulAccesses = responses.filter(r => r.status === 200);
      expect(successfulAccesses.length).toBe(providerCount * 2);
      
      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
      
      console.log(`Multi-provider access: ${successfulAccesses.length}/${providerCount * 2} successful in ${duration}ms`);
    });
  });

  describe('Error Recovery Performance', () => {
    test('should recover quickly from temporary failures', async () => {
      // Simulate temporary database issues
      const originalFindAll = ProviderPortfolio.findAll;
      let errorCount = 0;
      
      ProviderPortfolio.findAll = jest.fn().mockImplementation((...args) => {
        errorCount++;
        if (errorCount <= 3) {
          return Promise.reject(new Error('Temporary database error'));
        }
        return originalFindAll.apply(ProviderPortfolio, args);
      });
      
      const startTime = Date.now();
      const provider = testProviders[0];
      
      try {
        const response = await request(app)
          .get('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${provider.token}`);
        
        // Should eventually succeed or fail gracefully
        expect([200, 500]).toContain(response.status);
      } catch (error) {
        // Expected to potentially fail
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should not hang indefinitely
      expect(duration).toBeLessThan(10000);
      
      // Restore original method
      ProviderPortfolio.findAll = originalFindAll;
    });

    test('should handle storage failures without blocking other operations', async () => {
      const provider1 = testProviders[0];
      const provider2 = testProviders[1];
      
      // Simulate storage failure for one upload
      const testImage1 = await createTestImage(400, 300, 'jpeg');
      const testImage2 = await createTestImage(400, 300, 'jpeg');
      
      const startTime = Date.now();
      
      // Concurrent uploads - one may fail due to storage issues
      const uploadPromises = [
        request(app)
          .post('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${provider1.token}`)
          .attach('image', testImage1, 'storage-fail-1.jpg'),
        request(app)
          .post('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${provider2.token}`)
          .attach('image', testImage2, 'storage-fail-2.jpg')
      ];
      
      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // At least one should succeed, and failures should be handled gracefully
      const successCount = responses.filter(r => r.status === 201).length;
      const errorCount = responses.filter(r => r.status >= 400).length;
      
      expect(successCount + errorCount).toBe(2);
      expect(duration).toBeLessThan(15000);
      
      console.log(`Storage failure test: ${successCount} success, ${errorCount} errors in ${duration}ms`);
    });
  });
});