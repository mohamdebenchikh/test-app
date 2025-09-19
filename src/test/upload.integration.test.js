const UploadService = require('../services/upload.service');
const config = require('../config/config');

describe('UploadService Integration', () => {
  let uploadService;

  beforeEach(() => {
    uploadService = new UploadService();
  });

  describe('initialization with config', () => {
    it('should initialize with default portfolio config', () => {
      expect(uploadService.config).toEqual(config.portfolio.storage);
      expect(uploadService.storage).toBeDefined();
    });

    it('should initialize with local storage by default', () => {
      expect(uploadService.config.type).toBe('local');
      expect(uploadService.storage.constructor.name).toBe('LocalStorageBackend');
    });
  });

  describe('service methods', () => {
    const mockFile = {
      buffer: Buffer.from('test content'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg'
    };

    it('should have all required methods', () => {
      expect(typeof uploadService.uploadFile).toBe('function');
      expect(typeof uploadService.deleteFile).toBe('function');
      expect(typeof uploadService.getFileUrl).toBe('function');
      expect(typeof uploadService.fileExists).toBe('function');
      expect(typeof uploadService.getFileMetadata).toBe('function');
    });

    it('should handle file operations with unified interface', async () => {
      // Mock the storage backend methods
      uploadService.storage.uploadFile = jest.fn().mockResolvedValue({
        filename: 'test.jpg',
        path: 'test.jpg',
        url: '/uploads/portfolio/test.jpg'
      });
      uploadService.storage.deleteFile = jest.fn().mockResolvedValue(true);
      uploadService.storage.getFileUrl = jest.fn().mockResolvedValue('/uploads/portfolio/test.jpg');
      uploadService.storage.fileExists = jest.fn().mockResolvedValue(true);
      uploadService.storage.getFileMetadata = jest.fn().mockResolvedValue({
        size: 1024,
        lastModified: new Date()
      });

      // Test upload
      const uploadResult = await uploadService.uploadFile(mockFile);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.filename).toBe('test.jpg');

      // Test delete
      const deleteResult = await uploadService.deleteFile('test.jpg');
      expect(deleteResult).toBe(true);

      // Test URL generation
      const url = await uploadService.getFileUrl('test.jpg');
      expect(url).toBe('/uploads/portfolio/test.jpg');

      // Test file existence check
      const exists = await uploadService.fileExists('test.jpg');
      expect(exists).toBe(true);

      // Test metadata retrieval
      const metadata = await uploadService.getFileMetadata('test.jpg');
      expect(metadata.size).toBe(1024);
    });
  });

  describe('error handling', () => {
    it('should handle storage backend errors gracefully', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg'
      };

      uploadService.storage.uploadFile = jest.fn().mockRejectedValue(new Error('Storage error'));

      await expect(uploadService.uploadFile(mockFile)).rejects.toThrow('Upload failed: Storage error');
    });
  });

  describe('configuration switching', () => {
    it('should support switching to S3 storage', () => {
      const s3Config = {
        type: 's3',
        s3: {
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret'
        }
      };

      const s3UploadService = new UploadService(s3Config);
      
      expect(s3UploadService.config.type).toBe('s3');
      expect(s3UploadService.storage.constructor.name).toBe('S3StorageBackend');
    });

    it('should throw error for invalid storage type', () => {
      const invalidConfig = { type: 'invalid' };
      
      expect(() => new UploadService(invalidConfig)).toThrow('Unsupported storage type: invalid');
    });
  });
});