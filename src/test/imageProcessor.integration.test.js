const ImageProcessor = require('../utils/imageProcessor');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

describe('ImageProcessor Integration Tests', () => {
  let imageProcessor;
  const fixturesDir = path.join(__dirname, 'fixtures');
  const sampleImagePath = path.join(fixturesDir, 'sample-image.jpg');
  const portraitImagePath = path.join(fixturesDir, 'portrait-image.jpg');
  const smallImagePath = path.join(fixturesDir, 'small-image.jpg');
  const pngImagePath = path.join(fixturesDir, 'transparent-image.png');

  beforeAll(async () => {
    imageProcessor = new ImageProcessor();
    
    // Ensure test images exist
    try {
      await fs.access(sampleImagePath);
    } catch (error) {
      // Create test images if they don't exist
      const createTestImages = require('./fixtures/createTestImage');
      await createTestImages();
    }
  });

  describe('Real image file processing', () => {
    it('should process landscape JPEG image correctly', async () => {
      const result = await imageProcessor.generateImageVariants(sampleImagePath);
      
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('metadata');

      // Check metadata
      expect(result.metadata.width).toBe(800);
      expect(result.metadata.height).toBe(600);
      expect(result.metadata.format).toBe('jpeg');

      // Check thumbnail dimensions (150x150 cover)
      const thumbnailMeta = await sharp(result.thumbnail).metadata();
      expect(thumbnailMeta.width).toBe(150);
      expect(thumbnailMeta.height).toBe(150);

      // Check medium dimensions (400x400 inside, so should be 400x300)
      const mediumMeta = await sharp(result.medium).metadata();
      expect(mediumMeta.width).toBe(400);
      expect(mediumMeta.height).toBe(300);
    });

    it('should process portrait JPEG image correctly', async () => {
      const result = await imageProcessor.generateImageVariants(portraitImagePath);
      
      // Check metadata
      expect(result.metadata.width).toBe(400);
      expect(result.metadata.height).toBe(600);
      expect(result.metadata.format).toBe('jpeg');

      // Check thumbnail dimensions (150x150 cover)
      const thumbnailMeta = await sharp(result.thumbnail).metadata();
      expect(thumbnailMeta.width).toBe(150);
      expect(thumbnailMeta.height).toBe(150);

      // Check medium dimensions (400x400 inside, so should be 267x400)
      const mediumMeta = await sharp(result.medium).metadata();
      expect(mediumMeta.width).toBe(267);
      expect(mediumMeta.height).toBe(400);
    });

    it('should handle small images without enlargement', async () => {
      const result = await imageProcessor.generateImageVariants(smallImagePath);
      
      // Check metadata
      expect(result.metadata.width).toBe(100);
      expect(result.metadata.height).toBe(100);
      expect(result.metadata.format).toBe('jpeg');

      // Medium should not enlarge the image
      const mediumMeta = await sharp(result.medium).metadata();
      expect(mediumMeta.width).toBe(100);
      expect(mediumMeta.height).toBe(100);

      // Thumbnail generation respects withoutEnlargement setting
      const thumbnailMeta = await sharp(result.thumbnail).metadata();
      expect(thumbnailMeta.width).toBeLessThanOrEqual(150);
      expect(thumbnailMeta.height).toBeLessThanOrEqual(150);
    });

    it('should process PNG images with transparency', async () => {
      const result = await imageProcessor.generateImageVariants(pngImagePath);
      
      // Check metadata
      expect(result.metadata.width).toBe(300);
      expect(result.metadata.height).toBe(300);
      expect(result.metadata.format).toBe('png');

      // Check that PNG format is preserved
      const originalMeta = await sharp(result.original).metadata();
      expect(originalMeta.format).toBe('png');
      expect(originalMeta.hasAlpha).toBe(true);

      const thumbnailMeta = await sharp(result.thumbnail).metadata();
      expect(thumbnailMeta.format).toBe('png');
      expect(thumbnailMeta.hasAlpha).toBe(true);

      const mediumMeta = await sharp(result.medium).metadata();
      expect(mediumMeta.format).toBe('png');
      expect(mediumMeta.hasAlpha).toBe(true);
    });
  });

  describe('Individual processing methods with real files', () => {
    it('should generate thumbnails from real images', async () => {
      const thumbnail = await imageProcessor.generateThumbnail(sampleImagePath);
      
      const metadata = await sharp(thumbnail).metadata();
      expect(metadata.width).toBe(150);
      expect(metadata.height).toBe(150);
      expect(metadata.format).toBe('jpeg');
    });

    it('should generate medium sizes from real images', async () => {
      const medium = await imageProcessor.generateMediumSize(sampleImagePath);
      
      const metadata = await sharp(medium).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(300);
      expect(metadata.format).toBe('jpeg');
    });

    it('should optimize real images for web', async () => {
      const optimized = await imageProcessor.optimizeForWeb(sampleImagePath);
      
      const metadata = await sharp(optimized).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.format).toBe('jpeg');
      expect(Buffer.isBuffer(optimized)).toBe(true);
    });

    it('should get metadata from real images', async () => {
      const metadata = await imageProcessor.getImageMetadata(sampleImagePath);
      
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.hasAlpha).toBe(false);
      expect(metadata.density).toBeDefined();
    });
  });

  describe('Performance with real images', () => {
    it('should process images within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await imageProcessor.generateImageVariants(sampleImagePath);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process within 2 seconds for a typical image
      expect(processingTime).toBeLessThan(2000);
      
      // Should generate all variants
      expect(result.original).toBeDefined();
      expect(result.thumbnail).toBeDefined();
      expect(result.medium).toBeDefined();
    });

    it('should handle concurrent processing', async () => {
      const promises = [
        imageProcessor.generateImageVariants(sampleImagePath),
        imageProcessor.generateImageVariants(portraitImagePath),
        imageProcessor.generateImageVariants(smallImagePath)
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.original).toBeDefined();
        expect(result.thumbnail).toBeDefined();
        expect(result.medium).toBeDefined();
        expect(result.metadata).toBeDefined();
      });
    });
  });

  describe('Error handling with real scenarios', () => {
    it('should handle non-existent files gracefully', async () => {
      const nonExistentPath = path.join(fixturesDir, 'does-not-exist.jpg');
      
      await expect(imageProcessor.generateImageVariants(nonExistentPath))
        .rejects.toThrow('Image processing failed');
    });

    it('should handle corrupted image files', async () => {
      // Create a fake image file with invalid content
      const corruptedPath = path.join(fixturesDir, 'corrupted.jpg');
      await fs.writeFile(corruptedPath, 'This is not an image file');
      
      try {
        await expect(imageProcessor.generateImageVariants(corruptedPath))
          .rejects.toThrow('Image processing failed');
      } finally {
        // Clean up
        await fs.unlink(corruptedPath).catch(() => {});
      }
    });
  });
});