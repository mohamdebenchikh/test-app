const ImageProcessor = require('../utils/imageProcessor');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

describe('ImageProcessor', () => {
  let imageProcessor;
  let testImageBuffer;
  let testImagePath;

  beforeAll(async () => {
    imageProcessor = new ImageProcessor();
    
    // Create a test image buffer (500x300 JPEG)
    testImageBuffer = await sharp({
      create: {
        width: 500,
        height: 300,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg()
    .toBuffer();

    // Create test image file
    testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');
    await fs.mkdir(path.dirname(testImagePath), { recursive: true });
    await fs.writeFile(testImagePath, testImageBuffer);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.unlink(testImagePath);
      await fs.rmdir(path.dirname(testImagePath));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateImageVariants', () => {
    it('should generate all image variants from buffer', async () => {
      const result = await imageProcessor.generateImageVariants(testImageBuffer);

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('metadata');

      expect(Buffer.isBuffer(result.original)).toBe(true);
      expect(Buffer.isBuffer(result.thumbnail)).toBe(true);
      expect(Buffer.isBuffer(result.medium)).toBe(true);

      expect(result.metadata).toEqual({
        width: 500,
        height: 300,
        format: 'jpeg',
        size: expect.any(Number)
      });
    });

    it('should generate all image variants from file path', async () => {
      const result = await imageProcessor.generateImageVariants(testImagePath);

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('metadata');

      expect(Buffer.isBuffer(result.original)).toBe(true);
      expect(Buffer.isBuffer(result.thumbnail)).toBe(true);
      expect(Buffer.isBuffer(result.medium)).toBe(true);
    });

    it('should throw error for unsupported image format', async () => {
      // Create a text file buffer
      const textBuffer = Buffer.from('This is not an image');
      
      await expect(imageProcessor.generateImageVariants(textBuffer))
        .rejects.toThrow('Image processing failed');
    });

    it('should compress images for web optimization', async () => {
      const result = await imageProcessor.generateImageVariants(testImageBuffer);
      
      // Thumbnail should be much smaller than original due to size reduction
      expect(result.thumbnail.length).toBeLessThan(result.original.length);
      
      // Medium should be smaller than original for this test image
      expect(result.medium.length).toBeLessThan(result.original.length);
      
      // All variants should be valid image buffers
      expect(Buffer.isBuffer(result.original)).toBe(true);
      expect(Buffer.isBuffer(result.thumbnail)).toBe(true);
      expect(Buffer.isBuffer(result.medium)).toBe(true);
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with default size (150x150)', async () => {
      const thumbnail = await imageProcessor.generateThumbnail(testImageBuffer);
      
      expect(Buffer.isBuffer(thumbnail)).toBe(true);
      
      const metadata = await sharp(thumbnail).metadata();
      expect(metadata.width).toBe(150);
      expect(metadata.height).toBe(150);
    });

    it('should generate thumbnail with custom size', async () => {
      const thumbnail = await imageProcessor.generateThumbnail(testImageBuffer, {
        width: 100,
        height: 100
      });
      
      const metadata = await sharp(thumbnail).metadata();
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });

    it('should preserve aspect ratio with inside fit', async () => {
      const thumbnail = await imageProcessor.generateThumbnail(testImageBuffer, {
        width: 150,
        height: 150,
        fit: 'inside'
      });
      
      const metadata = await sharp(thumbnail).metadata();
      // Original is 500x300 (5:3 ratio), so inside 150x150 should be 150x90
      expect(metadata.width).toBe(150);
      expect(metadata.height).toBe(90);
    });

    it('should handle cover fit for thumbnails', async () => {
      const thumbnail = await imageProcessor.generateThumbnail(testImageBuffer, {
        width: 150,
        height: 150,
        fit: 'cover'
      });
      
      const metadata = await sharp(thumbnail).metadata();
      expect(metadata.width).toBe(150);
      expect(metadata.height).toBe(150);
    });
  });

  describe('generateMediumSize', () => {
    it('should generate medium size with default size (400x400)', async () => {
      const medium = await imageProcessor.generateMediumSize(testImageBuffer);
      
      expect(Buffer.isBuffer(medium)).toBe(true);
      
      const metadata = await sharp(medium).metadata();
      // Original is 500x300, inside 400x400 should be 400x240
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(240);
    });

    it('should generate medium size with custom dimensions', async () => {
      const medium = await imageProcessor.generateMediumSize(testImageBuffer, {
        width: 300,
        height: 300
      });
      
      const metadata = await sharp(medium).metadata();
      // Original is 500x300, inside 300x300 should be 300x180
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(180);
    });

    it('should not enlarge smaller images', async () => {
      // Create a small test image (100x60)
      const smallImageBuffer = await sharp({
        create: {
          width: 100,
          height: 60,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const medium = await imageProcessor.generateMediumSize(smallImageBuffer);
      
      const metadata = await sharp(medium).metadata();
      // Should not enlarge, so dimensions should remain 100x60
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(60);
    });
  });

  describe('optimizeForWeb', () => {
    it('should optimize image without resizing', async () => {
      const optimized = await imageProcessor.optimizeForWeb(testImageBuffer);
      
      expect(Buffer.isBuffer(optimized)).toBe(true);
      
      const metadata = await sharp(optimized).metadata();
      expect(metadata.width).toBe(500);
      expect(metadata.height).toBe(300);
      expect(metadata.format).toBe('jpeg');
      
      // Should maintain dimensions while being a valid optimized image
      expect(optimized.length).toBeGreaterThan(0);
    });

    it('should handle different image formats', async () => {
      // Create PNG test image
      const pngBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 0, g: 0, b: 255, alpha: 0.5 }
        }
      })
      .png()
      .toBuffer();

      const optimized = await imageProcessor.optimizeForWeb(pngBuffer);
      
      expect(Buffer.isBuffer(optimized)).toBe(true);
      
      const metadata = await sharp(optimized).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
    });
  });

  describe('getImageMetadata', () => {
    it('should return correct metadata for image buffer', async () => {
      const metadata = await imageProcessor.getImageMetadata(testImageBuffer);
      
      expect(metadata).toEqual({
        width: 500,
        height: 300,
        format: 'jpeg',
        size: expect.any(Number),
        density: expect.any(Number),
        hasAlpha: false,
        orientation: undefined
      });
    });

    it('should return correct metadata for image file', async () => {
      const metadata = await imageProcessor.getImageMetadata(testImagePath);
      
      expect(metadata.width).toBe(500);
      expect(metadata.height).toBe(300);
      expect(metadata.format).toBe('jpeg');
    });

    it('should throw error for invalid image', async () => {
      const invalidBuffer = Buffer.from('not an image');
      
      await expect(imageProcessor.getImageMetadata(invalidBuffer))
        .rejects.toThrow('Failed to get image metadata');
    });
  });

  describe('isValidImageFormat', () => {
    it('should return true for supported formats', () => {
      expect(imageProcessor.isValidImageFormat('jpeg')).toBe(true);
      expect(imageProcessor.isValidImageFormat('jpg')).toBe(true);
      expect(imageProcessor.isValidImageFormat('png')).toBe(true);
      expect(imageProcessor.isValidImageFormat('webp')).toBe(true);
      expect(imageProcessor.isValidImageFormat('JPEG')).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(imageProcessor.isValidImageFormat('gif')).toBe(false);
      expect(imageProcessor.isValidImageFormat('bmp')).toBe(false);
      expect(imageProcessor.isValidImageFormat('tiff')).toBe(false);
      expect(imageProcessor.isValidImageFormat('svg')).toBe(false);
      expect(imageProcessor.isValidImageFormat(null)).toBe(false);
      expect(imageProcessor.isValidImageFormat(undefined)).toBe(false);
    });
  });

  describe('calculateAspectRatio', () => {
    it('should calculate correct aspect ratio', () => {
      expect(imageProcessor.calculateAspectRatio(500, 300)).toBeCloseTo(1.667, 3);
      expect(imageProcessor.calculateAspectRatio(300, 500)).toBeCloseTo(0.6, 1);
      expect(imageProcessor.calculateAspectRatio(100, 100)).toBe(1);
    });
  });

  describe('calculateDimensions', () => {
    it('should calculate dimensions maintaining aspect ratio', () => {
      const result = imageProcessor.calculateDimensions(500, 300, 400, 400);
      
      expect(result.width).toBe(400);
      expect(result.height).toBe(240);
    });

    it('should handle portrait images', () => {
      const result = imageProcessor.calculateDimensions(300, 500, 400, 400);
      
      expect(result.width).toBe(240);
      expect(result.height).toBe(400);
    });

    it('should handle square images', () => {
      const result = imageProcessor.calculateDimensions(300, 300, 400, 400);
      
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });
  });

  describe('error handling', () => {
    it('should handle processing errors gracefully', async () => {
      const invalidBuffer = Buffer.from('invalid image data');
      
      await expect(imageProcessor.generateImageVariants(invalidBuffer))
        .rejects.toThrow('Image processing failed');
      
      await expect(imageProcessor.generateThumbnail(invalidBuffer))
        .rejects.toThrow('Thumbnail generation failed');
      
      await expect(imageProcessor.generateMediumSize(invalidBuffer))
        .rejects.toThrow('Medium size generation failed');
      
      await expect(imageProcessor.optimizeForWeb(invalidBuffer))
        .rejects.toThrow('Image optimization failed');
    });

    it('should handle file not found errors', async () => {
      const nonExistentPath = '/path/that/does/not/exist.jpg';
      
      await expect(imageProcessor.generateImageVariants(nonExistentPath))
        .rejects.toThrow('Image processing failed');
    });
  });

  describe('compression quality', () => {
    it('should apply different compression for different formats', async () => {
      // Test JPEG compression with uncompressed source
      const jpegBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .jpeg({ quality: 100 })
      .toBuffer();

      const compressedJpeg = await imageProcessor.optimizeForWeb(jpegBuffer);
      expect(Buffer.isBuffer(compressedJpeg)).toBe(true);
      
      const jpegMeta = await sharp(compressedJpeg).metadata();
      expect(jpegMeta.format).toBe('jpeg');

      // Test PNG compression with uncompressed source
      const pngBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
      .png({ compressionLevel: 0 })
      .toBuffer();

      const compressedPng = await imageProcessor.optimizeForWeb(pngBuffer);
      expect(Buffer.isBuffer(compressedPng)).toBe(true);
      
      const pngMeta = await sharp(compressedPng).metadata();
      expect(pngMeta.format).toBe('png');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle very large images', async () => {
      // Create a large test image (2000x1500)
      const largeImageBuffer = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await imageProcessor.generateImageVariants(largeImageBuffer);
      
      // Check thumbnail dimensions
      const thumbnailMeta = await sharp(result.thumbnail).metadata();
      expect(thumbnailMeta.width).toBe(150);
      expect(thumbnailMeta.height).toBe(150);
      
      // Check medium dimensions
      const mediumMeta = await sharp(result.medium).metadata();
      expect(mediumMeta.width).toBe(400);
      expect(mediumMeta.height).toBe(300);
    });

    it('should handle very small images', async () => {
      // Create a very small test image (50x30)
      const smallImageBuffer = await sharp({
        create: {
          width: 50,
          height: 30,
          channels: 3,
          background: { r: 200, g: 100, b: 50 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await imageProcessor.generateImageVariants(smallImageBuffer);
      
      // Original should remain small
      const originalMeta = await sharp(result.original).metadata();
      expect(originalMeta.width).toBe(50);
      expect(originalMeta.height).toBe(30);
      
      // Medium should not enlarge
      const mediumMeta = await sharp(result.medium).metadata();
      expect(mediumMeta.width).toBe(50);
      expect(mediumMeta.height).toBe(30);
    });
  });
});