const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create a test image buffer with specified dimensions and format
 * @param {number} width - Image width
 * @param {number} height - Image height  
 * @param {string} format - Image format ('jpeg', 'png', 'webp')
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} Image buffer
 */
async function createTestImage(width = 800, height = 600, format = 'jpeg', options = {}) {
  const { 
    background = { r: 100, g: 150, b: 200 },
    quality = 90 
  } = options;

  try {
    let sharpInstance = sharp({
      create: {
        width,
        height,
        channels: format === 'png' ? 4 : 3,
        background: format === 'png' ? { ...background, alpha: 1 } : background
      }
    });

    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png();
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    throw new Error(`Failed to create test image: ${error.message}`);
  }
}

/**
 * Utility script to create test images for manual testing
 */
async function createTestImages() {
  const fixturesDir = __dirname;
  
  try {
    // Create a colorful test image (800x600)
    const testImage = await createTestImage(800, 600, 'jpeg');
    await fs.writeFile(path.join(fixturesDir, 'sample-image.jpg'), testImage);
    console.log('Created sample-image.jpg (800x600)');

    // Create a portrait test image (400x600)
    const portraitImage = await createTestImage(400, 600, 'jpeg', {
      background: { r: 200, g: 100, b: 150 }
    });
    await fs.writeFile(path.join(fixturesDir, 'portrait-image.jpg'), portraitImage);
    console.log('Created portrait-image.jpg (400x600)');

    // Create a small test image (100x100)
    const smallImage = await createTestImage(100, 100, 'jpeg', {
      background: { r: 255, g: 200, b: 100 }
    });
    await fs.writeFile(path.join(fixturesDir, 'small-image.jpg'), smallImage);
    console.log('Created small-image.jpg (100x100)');

    // Create a PNG with transparency
    const pngImage = await createTestImage(300, 300, 'png', {
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    });
    await fs.writeFile(path.join(fixturesDir, 'transparent-image.png'), pngImage);
    console.log('Created transparent-image.png (300x300)');

    console.log('\nAll test images created successfully!');
    console.log('Files created in:', fixturesDir);
    
  } catch (error) {
    console.error('Error creating test images:', error);
  }
}

// Run if called directly
if (require.main === module) {
  createTestImages();
}

module.exports = {
  createTestImage,
  createTestImages
};