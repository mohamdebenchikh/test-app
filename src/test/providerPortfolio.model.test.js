/**
 * @fileoverview Unit tests for ProviderPortfolio model.
 */

const { sequelize, User, ProviderPortfolio } = require('../models');

describe('ProviderPortfolio Model', () => {
  let testProvider;
  let testClient;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Disable foreign key constraints for SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    }
  });

  beforeEach(async () => {
    // Create test users
    testProvider = await User.create({
      name: 'Test Provider',
      email: 'provider@test.com',
      password: 'hashedpassword',
      role: 'provider'
    });

    testClient = await User.create({
      name: 'Test Client',
      email: 'client@test.com',
      password: 'hashedpassword',
      role: 'client'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await ProviderPortfolio.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    // Re-enable foreign key constraints for SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    }
    
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('Model Creation and Validation', () => {
    it('should create a valid portfolio item', async () => {
      const portfolioData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        thumbnail_url: '/uploads/portfolio/thumb_image1.jpg',
        medium_url: '/uploads/portfolio/medium_image1.jpg',
        description: 'Test portfolio image',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      const portfolio = await ProviderPortfolio.create(portfolioData);

      expect(portfolio.id).toBeDefined();
      expect(portfolio.provider_id).toBe(testProvider.id);
      expect(portfolio.image_url).toBe(portfolioData.image_url);
      expect(portfolio.description).toBe(portfolioData.description);
      expect(portfolio.display_order).toBe(1); // Auto-set to 1 for first item
      expect(portfolio.file_size).toBe(portfolioData.file_size);
      expect(portfolio.mime_type).toBe(portfolioData.mime_type);
      expect(portfolio.original_filename).toBe(portfolioData.original_filename);
    });

    it('should auto-increment display_order for multiple items', async () => {
      const portfolioData1 = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image1.jpg'
      };

      const portfolioData2 = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image2.jpg',
        file_size: 2048000,
        mime_type: 'image/png',
        original_filename: 'test-image2.png'
      };

      const portfolio1 = await ProviderPortfolio.create(portfolioData1);
      const portfolio2 = await ProviderPortfolio.create(portfolioData2);

      expect(portfolio1.display_order).toBe(1);
      expect(portfolio2.display_order).toBe(2);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        provider_id: testProvider.id,
        // Missing required fields
      };

      await expect(ProviderPortfolio.create(invalidData)).rejects.toThrow();
    });

    it('should validate MIME type', async () => {
      const invalidMimeData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'application/pdf', // Invalid MIME type
        original_filename: 'test-image.jpg'
      };

      await expect(ProviderPortfolio.create(invalidMimeData)).rejects.toThrow();
    });

    it('should validate file size is positive', async () => {
      const invalidSizeData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 0, // Invalid file size
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      await expect(ProviderPortfolio.create(invalidSizeData)).rejects.toThrow();
    });

    it('should validate description length', async () => {
      const longDescription = 'a'.repeat(1001); // Exceeds 1000 character limit
      const invalidDescData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        description: longDescription,
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      await expect(ProviderPortfolio.create(invalidDescData)).rejects.toThrow();
    });

    it('should validate display_order is non-negative', async () => {
      const invalidOrderData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        display_order: -1, // Invalid negative order
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      await expect(ProviderPortfolio.create(invalidOrderData)).rejects.toThrow();
    });
  });

  describe('Provider Role Validation', () => {
    it('should only allow providers to create portfolio items', async () => {
      const portfolioData = {
        provider_id: testClient.id, // Client instead of provider
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      await expect(ProviderPortfolio.create(portfolioData)).rejects.toThrow('Portfolio can only be created for providers');
    });

    it('should validate provider exists', async () => {
      const portfolioData = {
        provider_id: '550e8400-e29b-41d4-a716-446655440000', // Non-existent user
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      await expect(ProviderPortfolio.create(portfolioData)).rejects.toThrow('Provider user not found');
    });

    it('should validate provider role on update', async () => {
      // Create a valid portfolio item first
      const portfolio = await ProviderPortfolio.create({
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      });

      // Try to update with client ID
      await expect(portfolio.update({ provider_id: testClient.id }))
        .rejects.toThrow('Portfolio can only be created for providers');
    });
  });

  describe('Model Associations', () => {
    it('should have association with User model', async () => {
      const portfolio = await ProviderPortfolio.create({
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      });

      const portfolioWithProvider = await ProviderPortfolio.findByPk(portfolio.id, {
        include: [{ model: User, as: 'provider' }]
      });

      expect(portfolioWithProvider.provider).toBeDefined();
      expect(portfolioWithProvider.provider.id).toBe(testProvider.id);
      expect(portfolioWithProvider.provider.name).toBe(testProvider.name);
    });

    it('should allow user to access portfolio images', async () => {
      await ProviderPortfolio.create({
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image1.jpg'
      });

      await ProviderPortfolio.create({
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image2.jpg',
        file_size: 2048000,
        mime_type: 'image/png',
        original_filename: 'test-image2.png'
      });

      const userWithPortfolio = await User.findByPk(testProvider.id, {
        include: [{ model: ProviderPortfolio, as: 'portfolioImages' }]
      });

      expect(userWithPortfolio.portfolioImages).toBeDefined();
      expect(userWithPortfolio.portfolioImages.length).toBe(2);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test portfolio items
      await ProviderPortfolio.bulkCreate([
        {
          provider_id: testProvider.id,
          image_url: '/uploads/portfolio/image1.jpg',
          display_order: 2,
          file_size: 1024000,
          mime_type: 'image/jpeg',
          original_filename: 'test-image1.jpg'
        },
        {
          provider_id: testProvider.id,
          image_url: '/uploads/portfolio/image2.jpg',
          display_order: 1,
          file_size: 2048000,
          mime_type: 'image/png',
          original_filename: 'test-image2.png'
        },
        {
          provider_id: testProvider.id,
          image_url: '/uploads/portfolio/image3.jpg',
          display_order: 3,
          file_size: 1536000,
          mime_type: 'image/webp',
          original_filename: 'test-image3.webp'
        }
      ]);
    });

    describe('getProviderPortfolio', () => {
      it('should return portfolio items ordered by display_order', async () => {
        const portfolio = await ProviderPortfolio.getProviderPortfolio(testProvider.id);

        expect(portfolio.length).toBe(3);
        expect(portfolio[0].display_order).toBe(1);
        expect(portfolio[1].display_order).toBe(2);
        expect(portfolio[2].display_order).toBe(3);
      });

      it('should support limit and offset options', async () => {
        const portfolio = await ProviderPortfolio.getProviderPortfolio(testProvider.id, {
          limit: 2,
          offset: 1
        });

        expect(portfolio.length).toBe(2);
        expect(portfolio[0].display_order).toBe(2);
        expect(portfolio[1].display_order).toBe(3);
      });

      it('should return empty array for non-existent provider', async () => {
        const portfolio = await ProviderPortfolio.getProviderPortfolio('550e8400-e29b-41d4-a716-446655440000');
        expect(portfolio.length).toBe(0);
      });
    });

    describe('updateDisplayOrder', () => {
      it('should update display order for multiple items', async () => {
        const portfolioItems = await ProviderPortfolio.findAll({
          where: { provider_id: testProvider.id },
          order: [['display_order', 'ASC']]
        });

        const orderUpdates = [
          { id: portfolioItems[0].id, display_order: 3 },
          { id: portfolioItems[1].id, display_order: 1 },
          { id: portfolioItems[2].id, display_order: 2 }
        ];

        const result = await ProviderPortfolio.updateDisplayOrder(testProvider.id, orderUpdates);
        expect(result).toBe(true);

        // Verify the updates
        const updatedPortfolio = await ProviderPortfolio.getProviderPortfolio(testProvider.id);
        expect(updatedPortfolio[0].id).toBe(portfolioItems[1].id); // Was order 2, now order 1
        expect(updatedPortfolio[1].id).toBe(portfolioItems[2].id); // Was order 3, now order 2
        expect(updatedPortfolio[2].id).toBe(portfolioItems[0].id); // Was order 1, now order 3
      });

      it('should only update items belonging to the provider', async () => {
        // Create another provider with portfolio
        const anotherProvider = await User.create({
          name: 'Another Provider',
          email: 'another@test.com',
          password: 'hashedpassword',
          role: 'provider'
        });

        const anotherPortfolio = await ProviderPortfolio.create({
          provider_id: anotherProvider.id,
          image_url: '/uploads/portfolio/other.jpg',
          file_size: 1024000,
          mime_type: 'image/jpeg',
          original_filename: 'other.jpg'
        });

        const portfolioItems = await ProviderPortfolio.findAll({
          where: { provider_id: testProvider.id }
        });

        // Try to update another provider's item - should throw error
        const orderUpdates = [
          { id: portfolioItems[0].id, display_order: 5 },
          { id: anotherPortfolio.id, display_order: 10 } // This should cause an error
        ];

        await expect(ProviderPortfolio.updateDisplayOrder(testProvider.id, orderUpdates))
          .rejects.toThrow('not found or does not belong to provider');

        // Verify no items were updated due to transaction rollback
        const unchangedItem1 = await ProviderPortfolio.findByPk(portfolioItems[0].id);
        const unchangedItem2 = await ProviderPortfolio.findByPk(anotherPortfolio.id);

        // The first item in the ordered list should have display_order 1 (not 2)
        expect(unchangedItem1.display_order).toBe(1); // Should remain unchanged due to rollback
        expect(unchangedItem2.display_order).toBe(1); // Should remain unchanged
      });

      it('should handle transaction rollback on error', async () => {
        const portfolioItems = await ProviderPortfolio.findAll({
          where: { provider_id: testProvider.id },
          order: [['display_order', 'ASC']]
        });

        // Create invalid update (non-existent ID)
        const orderUpdates = [
          { id: portfolioItems[0].id, display_order: 5 },
          { id: '550e8400-e29b-41d4-a716-446655440000', display_order: 10 } // Non-existent ID
        ];

        await expect(ProviderPortfolio.updateDisplayOrder(testProvider.id, orderUpdates))
          .rejects.toThrow();

        // Verify original item wasn't updated due to rollback
        const unchangedItem = await ProviderPortfolio.findByPk(portfolioItems[0].id);
        expect(unchangedItem.display_order).toBe(1); // Original value (first item has order 1)
      });
    });

    describe('getPortfolioCount', () => {
      it('should return correct count of portfolio items', async () => {
        const count = await ProviderPortfolio.getPortfolioCount(testProvider.id);
        expect(count).toBe(3);
      });

      it('should return 0 for provider with no portfolio', async () => {
        const anotherProvider = await User.create({
          name: 'Empty Provider',
          email: 'empty@test.com',
          password: 'hashedpassword',
          role: 'provider'
        });

        const count = await ProviderPortfolio.getPortfolioCount(anotherProvider.id);
        expect(count).toBe(0);
      });

      it('should return 0 for non-existent provider', async () => {
        const count = await ProviderPortfolio.getPortfolioCount('550e8400-e29b-41d4-a716-446655440000');
        expect(count).toBe(0);
      });
    });
  });

  describe('MIME Type Validation', () => {
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidMimeTypes = ['image/gif', 'image/bmp', 'application/pdf', 'text/plain'];

    validMimeTypes.forEach(mimeType => {
      it(`should accept valid MIME type: ${mimeType}`, async () => {
        const portfolioData = {
          provider_id: testProvider.id,
          image_url: '/uploads/portfolio/image1.jpg',
          file_size: 1024000,
          mime_type: mimeType,
          original_filename: 'test-image.jpg'
        };

        const portfolio = await ProviderPortfolio.create(portfolioData);
        expect(portfolio.mime_type).toBe(mimeType);
      });
    });

    invalidMimeTypes.forEach(mimeType => {
      it(`should reject invalid MIME type: ${mimeType}`, async () => {
        const portfolioData = {
          provider_id: testProvider.id,
          image_url: '/uploads/portfolio/image1.jpg',
          file_size: 1024000,
          mime_type: mimeType,
          original_filename: 'test-image.jpg'
        };

        await expect(ProviderPortfolio.create(portfolioData)).rejects.toThrow();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string validation', async () => {
      const invalidData = {
        provider_id: testProvider.id,
        image_url: '', // Empty string
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: ''  // Empty string
      };

      await expect(ProviderPortfolio.create(invalidData)).rejects.toThrow();
    });

    it('should handle null values for optional fields', async () => {
      const portfolioData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        thumbnail_url: null,
        medium_url: null,
        description: null,
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      const portfolio = await ProviderPortfolio.create(portfolioData);
      expect(portfolio.thumbnail_url).toBeNull();
      expect(portfolio.medium_url).toBeNull();
      expect(portfolio.description).toBeNull();
    });

    it('should handle very large file sizes', async () => {
      const portfolioData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 50 * 1024 * 1024, // 50MB
        mime_type: 'image/jpeg',
        original_filename: 'large-image.jpg'
      };

      const portfolio = await ProviderPortfolio.create(portfolioData);
      expect(portfolio.file_size).toBe(50 * 1024 * 1024);
    });

    it('should handle special characters in filenames', async () => {
      const portfolioData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image-with-special-chars_123!@#.jpg'
      };

      const portfolio = await ProviderPortfolio.create(portfolioData);
      expect(portfolio.original_filename).toBe('test-image-with-special-chars_123!@#.jpg');
    });

    it('should handle unicode characters in description', async () => {
      const portfolioData = {
        provider_id: testProvider.id,
        image_url: '/uploads/portfolio/image1.jpg',
        description: 'Test with unicode: 🎨 العربية français',
        file_size: 1024000,
        mime_type: 'image/jpeg',
        original_filename: 'test-image.jpg'
      };

      const portfolio = await ProviderPortfolio.create(portfolioData);
      expect(portfolio.description).toBe('Test with unicode: 🎨 العربية français');
    });
  });
});