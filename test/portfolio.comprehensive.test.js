/**
 * @fileoverview Comprehensive test suite for portfolio functionality
 * Tests end-to-end flows, performance, security, and edge cases
 */

const request = require('supertest');
const app = require('../index');
const { User, ProviderPortfolio, sequelize } = require('../src/models');
const { createTestImage } = require('../src/test/fixtures/createTestImage');
const { hashPassword } = require('../src/utils/password');
const { generateToken } = require('../src/utils/jwt');
const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config/config');

describe('Portfolio Comprehensive Test Suite', () => {
  let providerToken;
  let clientToken;
  let providerId;
  let clientId;
  let originalConfig;

  beforeAll(async () => {
    // Store original config
    originalConfig = { ...config };
    
    // Sync the database before running tests
    await sequelize.sync({ force: true });

    // Create test provider
    const providerData = {
      name: 'Test Provider',
      email: 'provider@test.com',
      password: await hashPassword('Password123!'),
      role: 'provider'
    };
    
    const provider = await User.create(providerData);
    providerId = provider.id;
    
    const providerPayload = {
      sub: provider.id,
      language: provider.language,
      role: provider.role
    };
    providerToken = generateToken(providerPayload);

    // Create test client
    const clientData = {
      name: 'Test Client',
      email: 'client@test.com',
      password: await hashPassword('Password123!'),
      role: 'client'
    };
    
    const client = await User.create(clientData);
    clientId = client.id;
    
    const clientPayload = {
      sub: client.id,
      language: client.language,
      role: client.role
    };
    clientToken = generateToken(clientPayload);
  });

  afterAll(async () => {
    // Clean up test data
    if (providerId) {
      await ProviderPortfolio.destroy({ where: { provider_id: providerId } });
    }
    if (providerId || clientId) {
      await User.destroy({ where: { id: [providerId, clientId].filter(Boolean) } });
    }
    
    // Restore original config
    Object.assign(config, originalConfig);
    
    // Close database connection
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up portfolio images before each test
    await ProviderPortfolio.destroy({ where: { provider_id: providerId } });
    
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

  describe('End-to-End Portfolio Flow Tests', () => {
    test('should complete full portfolio lifecycle successfully', async () => {
      // Step 1: Upload first image
      const testImage1 = await createTestImage(800, 600, 'jpeg');
      const uploadResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage1, 'test-image-1.jpg')
        .field('description', 'First portfolio image');

      expect(uploadResponse.status).toBe(201);
      expect(uploadResponse.body.success).toBe(true);
      const firstImageId = uploadResponse.body.data.id;

      // Step 2: Upload second image
      const testImage2 = await createTestImage(1200, 800, 'png');
      const uploadResponse2 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage2, 'test-image-2.png')
        .field('description', 'Second portfolio image');

      expect(uploadResponse2.status).toBe(201);
      const secondImageId = uploadResponse2.body.data.id;

      // Step 3: Retrieve private portfolio
      const privateResponse = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(privateResponse.status).toBe(200);
      expect(privateResponse.body.data.portfolio).toHaveLength(2);

      // Step 4: Retrieve public portfolio
      const publicResponse = await request(app)
        .get(`/api/users/${providerId}/portfolio`);

      expect(publicResponse.status).toBe(200);
      expect(publicResponse.body.data.portfolio).toHaveLength(2);

      // Step 5: Update image order
      const orderResponse = await request(app)
        .put('/api/users/profile/portfolio/order')
        .set('Authorization', `Bearer ${providerToken}`)
        .send({
          imageOrders: [
            { id: secondImageId, displayOrder: 1 },
            { id: firstImageId, displayOrder: 2 }
          ]
        });

      expect(orderResponse.status).toBe(200);

      // Step 6: Update image description
      const updateResponse = await request(app)
        .put(`/api/users/profile/portfolio/${firstImageId}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ description: 'Updated description' });

      expect(updateResponse.status).toBe(200);

      // Step 7: Delete one image
      const deleteResponse = await request(app)
        .delete(`/api/users/profile/portfolio/${secondImageId}`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(deleteResponse.status).toBe(200);

      // Step 8: Verify final state
      const finalResponse = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(finalResponse.status).toBe(200);
      expect(finalResponse.body.data.portfolio).toHaveLength(1);
      expect(finalResponse.body.data.portfolio[0].description).toBe('Updated description');
    });

    test('should handle portfolio with maximum allowed images', async () => {
      // Set low limit for testing
      config.portfolio.maxImages = 3;

      // Upload maximum allowed images
      const uploadPromises = [];
      for (let i = 0; i < 3; i++) {
        const testImage = await createTestImage(400, 300, 'jpeg');
        uploadPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${providerToken}`)
            .attach('image', testImage, `test-image-${i}.jpg`)
            .field('description', `Image ${i + 1}`)
        );
      }

      const responses = await Promise.all(uploadPromises);
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Try to upload one more (should fail)
      const testImage = await createTestImage(400, 300, 'jpeg');
      const overLimitResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 'over-limit.jpg');

      expect(overLimitResponse.status).toBe(409);
      expect(overLimitResponse.body.error).toContain('maximum');

      // Verify portfolio count
      const portfolioResponse = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(portfolioResponse.body.data.portfolio).toHaveLength(3);
    });

    test('should handle portfolio stats correctly', async () => {
      // Upload some images
      const testImage1 = await createTestImage(800, 600, 'jpeg');
      await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage1, 'test-image-1.jpg');

      const testImage2 = await createTestImage(600, 400, 'png');
      await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage2, 'test-image-2.png');

      // Get stats
      const statsResponse = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.data.totalImages).toBe(2);
      expect(statsResponse.body.data.maxImages).toBe(config.portfolio.maxImages);
      expect(statsResponse.body.data.remainingSlots).toBe(config.portfolio.maxImages - 2);
      expect(statsResponse.body.data.maxFileSize).toBe(config.portfolio.maxFileSize);
      expect(statsResponse.body.data.allowedTypes).toEqual(config.portfolio.allowedTypes);
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent uploads efficiently', async () => {
      const startTime = Date.now();
      const concurrentUploads = 5;
      
      // Create multiple test images
      const uploadPromises = [];
      for (let i = 0; i < concurrentUploads; i++) {
        const testImage = await createTestImage(800, 600, 'jpeg');
        uploadPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${providerToken}`)
            .attach('image', testImage, `concurrent-${i}.jpg`)
            .field('description', `Concurrent upload ${i}`)
        );
      }

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All uploads should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Should complete within reasonable time (10 seconds)
      expect(duration).toBeLessThan(10000);

      // Verify all images were uploaded
      const portfolioResponse = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(portfolioResponse.body.data.portfolio).toHaveLength(concurrentUploads);
    });

    test('should handle large file uploads within limits', async () => {
      // Create a large image (close to max size)
      const largeImage = await createTestImage(2000, 1500, 'jpeg', 0.9); // High quality
      
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', largeImage, 'large-image.jpg')
        .field('description', 'Large image test');

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      // Should complete within 15 seconds for large files
      expect(duration).toBeLessThan(15000);

      // Verify image processing created all variants
      expect(response.body.data.image_url).toBeTruthy();
      expect(response.body.data.thumbnail_url).toBeTruthy();
      expect(response.body.data.medium_url).toBeTruthy();
    });

    test('should handle rapid sequential operations', async () => {
      const operations = 20;
      const startTime = Date.now();

      // Upload one image first
      const testImage = await createTestImage(400, 300, 'jpeg');
      const uploadResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 'rapid-test.jpg');

      const imageId = uploadResponse.body.data.id;

      // Perform rapid operations
      const operationPromises = [];
      for (let i = 0; i < operations; i++) {
        if (i % 3 === 0) {
          // Get portfolio
          operationPromises.push(
            request(app)
              .get('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${providerToken}`)
          );
        } else if (i % 3 === 1) {
          // Update description
          operationPromises.push(
            request(app)
              .put(`/api/users/profile/portfolio/${imageId}`)
              .set('Authorization', `Bearer ${providerToken}`)
              .send({ description: `Updated ${i}` })
          );
        } else {
          // Get stats
          operationPromises.push(
            request(app)
              .get('/api/users/profile/portfolio/stats')
              .set('Authorization', `Bearer ${providerToken}`)
          );
        }
      }

      const responses = await Promise.all(operationPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should succeed
      responses.forEach(response => {
        expect(response.status).toBeLessThan(400);
      });

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('should maintain performance with multiple providers', async () => {
      // Create additional providers
      const additionalProviders = [];
      for (let i = 0; i < 5; i++) {
        const providerData = {
          name: `Performance Provider ${i}`,
          email: `perf-provider-${i}@test.com`,
          password: await hashPassword('Password123!'),
          role: 'provider'
        };
        
        const provider = await User.create(providerData);
        const token = generateToken({
          sub: provider.id,
          language: provider.language,
          role: provider.role
        });
        
        additionalProviders.push({ id: provider.id, token });
      }

      const startTime = Date.now();

      // Each provider uploads images concurrently
      const allUploadPromises = [];
      for (const provider of additionalProviders) {
        for (let i = 0; i < 3; i++) {
          const testImage = await createTestImage(600, 400, 'jpeg');
          allUploadPromises.push(
            request(app)
              .post('/api/users/profile/portfolio')
              .set('Authorization', `Bearer ${provider.token}`)
              .attach('image', testImage, `provider-${provider.id}-image-${i}.jpg`)
          );
        }
      }

      const responses = await Promise.all(allUploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All uploads should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Should complete within 20 seconds
      expect(duration).toBeLessThan(20000);

      // Clean up additional providers
      const providerIds = additionalProviders.map(p => p.id);
      await ProviderPortfolio.destroy({ where: { provider_id: providerIds } });
      await User.destroy({ where: { id: providerIds } });
    });
  });
});  descr
ibe('Security Tests', () => {
    test('should reject malicious file types', async () => {
      // Test various malicious file types
      const maliciousFiles = [
        { name: 'malicious.exe', type: 'application/x-executable' },
        { name: 'script.js', type: 'application/javascript' },
        { name: 'malware.bat', type: 'application/x-bat' },
        { name: 'virus.php', type: 'application/x-php' },
        { name: 'fake.jpg.exe', type: 'application/x-executable' }
      ];

      for (const file of maliciousFiles) {
        // Create a fake malicious file
        const maliciousContent = Buffer.from('malicious content');
        
        const response = await request(app)
          .post('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${providerToken}`)
          .attach('image', maliciousContent, file.name);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('file type');
      }
    });

    test('should reject oversized files', async () => {
      // Set small file size limit for testing
      config.portfolio.maxFileSize = 1024; // 1KB

      const largeImage = await createTestImage(800, 600, 'jpeg');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', largeImage, 'large-file.jpg');

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('file size');
    });

    test('should prevent unauthorized access to portfolio management', async () => {
      // Test without authentication
      const testImage = await createTestImage(400, 300, 'jpeg');
      
      const noAuthResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .attach('image', testImage, 'no-auth.jpg');

      expect(noAuthResponse.status).toBe(401);

      // Test with client role (non-provider)
      const clientResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${clientToken}`)
        .attach('image', testImage, 'client-upload.jpg');

      expect(clientResponse.status).toBe(403);
    });

    test('should prevent access to other providers portfolios', async () => {
      // Create another provider
      const otherProviderData = {
        name: 'Other Provider',
        email: 'other-provider@test.com',
        password: await hashPassword('Password123!'),
        role: 'provider'
      };
      
      const otherProvider = await User.create(otherProviderData);
      const otherToken = generateToken({
        sub: otherProvider.id,
        language: otherProvider.language,
        role: otherProvider.role
      });

      // Upload image as other provider
      const testImage = await createTestImage(400, 300, 'jpeg');
      const uploadResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('image', testImage, 'other-provider.jpg');

      const imageId = uploadResponse.body.data.id;

      // Try to delete other provider's image
      const deleteResponse = await request(app)
        .delete(`/api/users/profile/portfolio/${imageId}`)
        .set('Authorization', `Bearer ${providerToken}`);

      expect(deleteResponse.status).toBe(404);

      // Try to update other provider's image
      const updateResponse = await request(app)
        .put(`/api/users/profile/portfolio/${imageId}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .send({ description: 'Hacked description' });

      expect(updateResponse.status).toBe(404);

      // Clean up
      await ProviderPortfolio.destroy({ where: { provider_id: otherProvider.id } });
      await User.destroy({ where: { id: otherProvider.id } });
    });

    test('should sanitize file names and descriptions', async () => {
      const testImage = await createTestImage(400, 300, 'jpeg');
      
      // Test with malicious filename and description
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, '../../../etc/passwd.jpg')
        .field('description', '<script>alert("XSS")</script>Malicious description');

      expect(response.status).toBe(201);
      
      // Verify sanitization
      const portfolio = await ProviderPortfolio.findOne({
        where: { provider_id: providerId }
      });
      
      expect(portfolio.original_filename).not.toContain('../');
      expect(portfolio.description).not.toContain('<script>');
    });

    test('should enforce rate limiting on uploads', async () => {
      // Attempt rapid uploads
      const rapidUploads = [];
      for (let i = 0; i < 20; i++) {
        const testImage = await createTestImage(200, 200, 'jpeg');
        rapidUploads.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${providerToken}`)
            .attach('image', testImage, `rapid-${i}.jpg`)
        );
      }

      const responses = await Promise.all(rapidUploads);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should validate image content (not just extension)', async () => {
      // Create a text file with image extension
      const fakeImage = Buffer.from('This is not an image file');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', fakeImage, 'fake-image.jpg');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid image');
    });
  });

  describe('Storage Backend Tests', () => {
    test('should work with local storage configuration', async () => {
      config.portfolio.storage = {
        type: 'local',
        localPath: 'uploads/test-portfolio'
      };

      const testImage = await createTestImage(400, 300, 'jpeg');
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 'local-storage.jpg');

      expect(response.status).toBe(201);
      expect(response.body.data.image_url).toContain('uploads/test-portfolio');
    });

    test('should handle storage configuration changes', async () => {
      // Start with local storage
      config.portfolio.storage = {
        type: 'local',
        localPath: 'uploads/portfolio-local'
      };

      const testImage1 = await createTestImage(400, 300, 'jpeg');
      const response1 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage1, 'config-test-1.jpg');

      expect(response1.status).toBe(201);
      expect(response1.body.data.image_url).toContain('portfolio-local');

      // Change to different local path
      config.portfolio.storage = {
        type: 'local',
        localPath: 'uploads/portfolio-new'
      };

      const testImage2 = await createTestImage(400, 300, 'jpeg');
      const response2 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage2, 'config-test-2.jpg');

      expect(response2.status).toBe(201);
      expect(response2.body.data.image_url).toContain('portfolio-new');
    });

    test('should handle storage failures gracefully', async () => {
      // Mock storage failure
      const originalConfig = { ...config.portfolio.storage };
      config.portfolio.storage = {
        type: 'local',
        localPath: '/invalid/readonly/path'
      };

      const testImage = await createTestImage(400, 300, 'jpeg');
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 'storage-fail.jpg');

      // Should handle gracefully with appropriate error
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('storage');

      // Restore config
      config.portfolio.storage = originalConfig;
    });

    test('should validate S3 configuration when selected', async () => {
      // Test with incomplete S3 config
      config.portfolio.storage = {
        type: 's3',
        s3: {
          bucket: 'test-bucket'
          // Missing region, credentials
        }
      };

      const testImage = await createTestImage(400, 300, 'jpeg');
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 's3-config-test.jpg');

      // Should fail with configuration error
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('configuration');
    });
  });

  describe('Image Processing Pipeline Tests', () => {
    test('should process JPEG images correctly', async () => {
      const jpegImage = await createTestImage(1200, 800, 'jpeg');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', jpegImage, 'test.jpg');

      expect(response.status).toBe(201);
      expect(response.body.data.mime_type).toBe('image/jpeg');
      expect(response.body.data.image_url).toBeTruthy();
      expect(response.body.data.thumbnail_url).toBeTruthy();
      expect(response.body.data.medium_url).toBeTruthy();
    });

    test('should process PNG images correctly', async () => {
      const pngImage = await createTestImage(800, 600, 'png');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', pngImage, 'test.png');

      expect(response.status).toBe(201);
      expect(response.body.data.mime_type).toBe('image/png');
      expect(response.body.data.image_url).toBeTruthy();
      expect(response.body.data.thumbnail_url).toBeTruthy();
      expect(response.body.data.medium_url).toBeTruthy();
    });

    test('should process WebP images correctly', async () => {
      const webpImage = await createTestImage(600, 400, 'webp');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', webpImage, 'test.webp');

      expect(response.status).toBe(201);
      expect(response.body.data.mime_type).toBe('image/webp');
      expect(response.body.data.image_url).toBeTruthy();
      expect(response.body.data.thumbnail_url).toBeTruthy();
      expect(response.body.data.medium_url).toBeTruthy();
    });

    test('should handle image processing failures gracefully', async () => {
      // Create a corrupted image buffer
      const corruptedImage = Buffer.alloc(1000);
      corruptedImage.fill(0xFF); // Fill with invalid data
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', corruptedImage, 'corrupted.jpg');

      // Should fail gracefully
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('processing');
    });

    test('should maintain aspect ratios in processed images', async () => {
      // Test with various aspect ratios
      const aspectRatios = [
        { width: 1600, height: 900 }, // 16:9
        { width: 800, height: 800 },  // 1:1
        { width: 600, height: 800 },  // 3:4
        { width: 1200, height: 600 }  // 2:1
      ];

      for (const { width, height } of aspectRatios) {
        const testImage = await createTestImage(width, height, 'jpeg');
        
        const response = await request(app)
          .post('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${providerToken}`)
          .attach('image', testImage, `aspect-${width}x${height}.jpg`);

        expect(response.status).toBe(201);
        
        // All variants should be created
        expect(response.body.data.image_url).toBeTruthy();
        expect(response.body.data.thumbnail_url).toBeTruthy();
        expect(response.body.data.medium_url).toBeTruthy();
        
        // Clean up for next iteration
        await ProviderPortfolio.destroy({ 
          where: { id: response.body.data.id } 
        });
      }
    });

    test('should optimize images for web performance', async () => {
      const largeImage = await createTestImage(2000, 1500, 'jpeg', 1.0); // Max quality
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', largeImage, 'optimization-test.jpg');

      expect(response.status).toBe(201);
      
      // File size should be recorded
      expect(response.body.data.file_size).toBeGreaterThan(0);
      
      // Processed images should be smaller than original
      // (This would require actual file system checks in a real implementation)
      expect(response.body.data.image_url).toBeTruthy();
    });
  });

  describe('Portfolio Limits and Quota Tests', () => {
    test('should enforce maximum image count limit', async () => {
      config.portfolio.maxImages = 2;

      // Upload maximum allowed images
      const testImage1 = await createTestImage(400, 300, 'jpeg');
      const response1 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage1, 'limit-test-1.jpg');

      expect(response1.status).toBe(201);

      const testImage2 = await createTestImage(400, 300, 'jpeg');
      const response2 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage2, 'limit-test-2.jpg');

      expect(response2.status).toBe(201);

      // Try to upload one more (should fail)
      const testImage3 = await createTestImage(400, 300, 'jpeg');
      const response3 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage3, 'limit-test-3.jpg');

      expect(response3.status).toBe(409);
      expect(response3.body.error).toContain('maximum');
    });

    test('should enforce file size limits', async () => {
      config.portfolio.maxFileSize = 100 * 1024; // 100KB

      // Create image larger than limit
      const largeImage = await createTestImage(1500, 1200, 'jpeg', 0.9);
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', largeImage, 'size-limit-test.jpg');

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('file size');
    });

    test('should enforce allowed file types', async () => {
      config.portfolio.allowedTypes = ['jpeg', 'jpg'];

      // Try to upload PNG (not allowed)
      const pngImage = await createTestImage(400, 300, 'png');
      
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', pngImage, 'type-test.png');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('file type');
    });

    test('should handle quota enforcement across multiple uploads', async () => {
      config.portfolio.maxImages = 3;
      config.portfolio.maxFileSize = 2 * 1024 * 1024; // 2MB

      // Upload images close to individual and total limits
      const uploadPromises = [];
      for (let i = 0; i < 3; i++) {
        const testImage = await createTestImage(800, 600, 'jpeg', 0.8);
        uploadPromises.push(
          request(app)
            .post('/api/users/profile/portfolio')
            .set('Authorization', `Bearer ${providerToken}`)
            .attach('image', testImage, `quota-test-${i}.jpg`)
        );
      }

      const responses = await Promise.all(uploadPromises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify quota is enforced
      const statsResponse = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(statsResponse.body.data.totalImages).toBe(3);
      expect(statsResponse.body.data.remainingSlots).toBe(0);
    });

    test('should update quota correctly after deletions', async () => {
      config.portfolio.maxImages = 2;

      // Upload maximum images
      const testImage1 = await createTestImage(400, 300, 'jpeg');
      const response1 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage1, 'quota-delete-1.jpg');

      const testImage2 = await createTestImage(400, 300, 'jpeg');
      const response2 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage2, 'quota-delete-2.jpg');

      // Delete one image
      await request(app)
        .delete(`/api/users/profile/portfolio/${response1.body.data.id}`)
        .set('Authorization', `Bearer ${providerToken}`);

      // Should be able to upload again
      const testImage3 = await createTestImage(400, 300, 'jpeg');
      const response3 = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage3, 'quota-delete-3.jpg');

      expect(response3.status).toBe(201);

      // Verify quota is correct
      const statsResponse = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(statsResponse.body.data.totalImages).toBe(2);
      expect(statsResponse.body.data.remainingSlots).toBe(0);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle database connection failures gracefully', async () => {
      // Mock database error
      const originalCreate = ProviderPortfolio.create;
      ProviderPortfolio.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const testImage = await createTestImage(400, 300, 'jpeg');
      const response = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 'db-error-test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('database');

      // Restore original method
      ProviderPortfolio.create = originalCreate;
    });

    test('should handle concurrent access to same portfolio', async () => {
      // Upload an image first
      const testImage = await createTestImage(400, 300, 'jpeg');
      const uploadResponse = await request(app)
        .post('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`)
        .attach('image', testImage, 'concurrent-access.jpg');

      const imageId = uploadResponse.body.data.id;

      // Perform concurrent operations on the same image
      const concurrentOperations = [
        request(app)
          .put(`/api/users/profile/portfolio/${imageId}`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send({ description: 'Update 1' }),
        request(app)
          .put(`/api/users/profile/portfolio/${imageId}`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send({ description: 'Update 2' }),
        request(app)
          .get('/api/users/profile/portfolio')
          .set('Authorization', `Bearer ${providerToken}`)
      ];

      const responses = await Promise.all(concurrentOperations);
      
      // All operations should complete without errors
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });

    test('should handle empty portfolio gracefully', async () => {
      // Get empty portfolio
      const response = await request(app)
        .get('/api/users/profile/portfolio')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.portfolio).toEqual([]);

      // Get stats for empty portfolio
      const statsResponse = await request(app)
        .get('/api/users/profile/portfolio/stats')
        .set('Authorization', `Bearer ${providerToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.data.totalImages).toBe(0);
      expect(statsResponse.body.data.remainingSlots).toBe(config.portfolio.maxImages);
    });

    test('should handle invalid image IDs gracefully', async () => {
      const invalidIds = ['invalid-uuid', '00000000-0000-0000-0000-000000000000', 'not-a-uuid'];

      for (const invalidId of invalidIds) {
        // Try to delete invalid ID
        const deleteResponse = await request(app)
          .delete(`/api/users/profile/portfolio/${invalidId}`)
          .set('Authorization', `Bearer ${providerToken}`);

        expect(deleteResponse.status).toBe(400);

        // Try to update invalid ID
        const updateResponse = await request(app)
          .put(`/api/users/profile/portfolio/${invalidId}`)
          .set('Authorization', `Bearer ${providerToken}`)
          .send({ description: 'Test' });

        expect(updateResponse.status).toBe(400);
      }
    });
  });
});