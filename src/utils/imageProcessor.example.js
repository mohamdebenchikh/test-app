const ImageProcessor = require('./imageProcessor');
const fs = require('fs').promises;
const path = require('path');

/**
 * Example usage of the ImageProcessor utility
 * This demonstrates how to use the image processing capabilities
 */
async function demonstrateImageProcessing() {
  const imageProcessor = new ImageProcessor();
  const testImagePath = path.join(__dirname, '../test/fixtures/sample-image.jpg');
  
  try {
    console.log('🖼️  Image Processing Demo');
    console.log('========================\n');
    
    // Check if test image exists
    try {
      await fs.access(testImagePath);
    } catch (error) {
      console.log('Creating test images...');
      const createTestImages = require('../test/fixtures/createTestImage');
      await createTestImages();
    }
    
    console.log('📊 Getting image metadata...');
    const metadata = await imageProcessor.getImageMetadata(testImagePath);
    console.log('Original image:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha
    });
    console.log('');
    
    console.log('🔄 Generating image variants...');
    const startTime = Date.now();
    const variants = await imageProcessor.generateImageVariants(testImagePath);
    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Processing completed in ${processingTime}ms`);
    console.log('');
    
    // Display variant information
    console.log('📏 Generated variants:');
    
    // Original (optimized)
    console.log(`Original (optimized): ${variants.original.length} bytes`);
    
    // Thumbnail
    const thumbnailMeta = await imageProcessor.getImageMetadata(variants.thumbnail);
    console.log(`Thumbnail (${thumbnailMeta.width}x${thumbnailMeta.height}): ${variants.thumbnail.length} bytes`);
    
    // Medium
    const mediumMeta = await imageProcessor.getImageMetadata(variants.medium);
    console.log(`Medium (${mediumMeta.width}x${mediumMeta.height}): ${variants.medium.length} bytes`);
    console.log('');
    
    // Demonstrate individual methods
    console.log('🎯 Individual processing methods:');
    
    // Custom thumbnail
    const customThumbnail = await imageProcessor.generateThumbnail(testImagePath, {
      width: 100,
      height: 100,
      fit: 'cover'
    });
    const customThumbMeta = await imageProcessor.getImageMetadata(customThumbnail);
    console.log(`Custom thumbnail (${customThumbMeta.width}x${customThumbMeta.height}): ${customThumbnail.length} bytes`);
    
    // Web optimization
    const webOptimized = await imageProcessor.optimizeForWeb(testImagePath);
    console.log(`Web optimized: ${webOptimized.length} bytes`);
    console.log('');
    
    // Demonstrate utility methods
    console.log('🧮 Utility calculations:');
    const aspectRatio = imageProcessor.calculateAspectRatio(metadata.width, metadata.height);
    console.log(`Aspect ratio: ${aspectRatio.toFixed(3)}`);
    
    const newDimensions = imageProcessor.calculateDimensions(
      metadata.width, 
      metadata.height, 
      300, 
      300
    );
    console.log(`Fit in 300x300: ${newDimensions.width}x${newDimensions.height}`);
    console.log('');
    
    // Format validation
    console.log('✅ Format validation:');
    console.log(`JPEG supported: ${imageProcessor.isValidImageFormat('jpeg')}`);
    console.log(`PNG supported: ${imageProcessor.isValidImageFormat('png')}`);
    console.log(`WebP supported: ${imageProcessor.isValidImageFormat('webp')}`);
    console.log(`GIF supported: ${imageProcessor.isValidImageFormat('gif')}`);
    console.log('');
    
    console.log('🎉 Demo completed successfully!');
    console.log('');
    console.log('💡 Usage tips:');
    console.log('- Use generateImageVariants() for complete portfolio processing');
    console.log('- Use individual methods for specific needs');
    console.log('- All methods support both file paths and buffers');
    console.log('- Images are automatically compressed for web optimization');
    console.log('- Aspect ratios are preserved with configurable fit options');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Run demo if called directly
if (require.main === module) {
  demonstrateImageProcessing();
}

module.exports = demonstrateImageProcessing;