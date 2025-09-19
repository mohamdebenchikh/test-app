const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { portfolioImageUpload, portfolioAccess } = require('../middlewares/portfolioUpload');
const { ProviderPortfolio } = require('../models');

// Mock the models
jest.mock('../models', () => ({
  ProviderPortfolio: {
    count: jest.fn()
  }
}));

describe('Portfolio Upload Integration Tests', () => {
  let app;
  let testImagePath;

  beforeAll(() => {
    // Create test image
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    testImagePath = path.join(fixturesDir, 'test-portfolio.jpg');

    // Create a minimal JPEG file
    const jpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xD9
    ]);
    fs.writeFileSync(testImagePath, jpegBuffer);
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authenticated provider user
    app.use((req, res, next) => {
      req.user = { id: 'provider-123', role: 'provider' };
      next();
    });

    // Test endpoints
    app.post('/upload', portfolioImageUpload, (req, res) => {
      res.status(200).json({ 
        success: true, 
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : null
      });
    });

    app.get('/portfolio', portfolioAccess, (req, res) => {
      res.status(200).json({ success: true });
    });

    // Error handler
    app.use((error, req, res, next) => {
      res.status(error.statusCode || 500).json({
        message: error.message
      });
    });

    jest.clearAllMocks();
    ProviderPortfolio.count.mockResolvedValue(2); // Under limit by default
  });

  describe('File Upload', () => {
    it('should successfully upload valid JPEG image', async () => {
      const response = await request(app)
        .post('/upload')
        .attach('image', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.file.mimetype).toBe('image/jpeg');
      expect(response.body.file.originalname).toBe('test-portfolio.jpg');
    });

    // Note: Portfolio limit validation is thoroughly tested in unit tests
    // Integration test focuses on successful upload flow
  });

  describe('Access Control', () => {
    it('should allow provider access to portfolio endpoints', async () => {
      const response = await request(app).get('/portfolio');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject non-provider access', async () => {
      // Create app with client user
      const clientApp = express();
      clientApp.use((req, res, next) => {
        req.user = { id: 'client-123', role: 'client' };
        next();
      });
      clientApp.get('/portfolio', portfolioAccess, (req, res) => {
        res.status(200).json({ success: true });
      });
      clientApp.use((error, req, res, next) => {
        res.status(error.statusCode || 500).json({
          message: error.message
        });
      });

      const response = await request(clientApp).get('/portfolio');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Only service providers can manage portfolio images');
    });
  });
});