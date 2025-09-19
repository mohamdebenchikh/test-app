const UploadService = require('../services/upload.service');
const LocalStorageBackend = require('../services/storage/LocalStorageBackend');
const S3StorageBackend = require('../services/storage/S3StorageBackend');

// Mock the storage backends
jest.mock('../services/storage/LocalStorageBackend');
jest.mock('../services/storage/S3StorageBackend');

describe('UploadService', () => {
  let uploadService;
  let mockStorageBackend;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageBackend = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn(),
      fileExists: jest.fn(),
      getFileMetadata: jest.fn()
    };
  });

  describe('constructor', () => {
    it('should initialize with local storage backend', () => {
      const config = { type: 'local', local: { path: 'uploads' } };
      LocalStorageBackend.mockImplementation(() => mockStorageBackend);
      
      uploadService = new UploadService(config);
      
      expect(LocalStorageBackend).toHaveBeenCalledWith({ path: 'uploads' });
      expect(uploadService.storage).toBe(mockStorageBackend);
    });

    it('should initialize with S3 storage backend', () => {
      const config = { 
        type: 's3', 
        s3: { 
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret'
        } 
      };
      S3StorageBackend.mockImplementation(() => mockStorageBackend);
      
      uploadService = new UploadService(config);
      
      expect(S3StorageBackend).toHaveBeenCalledWith(config.s3);
      expect(uploadService.storage).toBe(mockStorageBackend);
    });

    it('should throw error for unsupported storage type', () => {
      const config = { type: 'unsupported' };
      
      expect(() => new UploadService(config)).toThrow('Unsupported storage type: unsupported');
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      const config = { type: 'local', local: { path: 'uploads' } };
      LocalStorageBackend.mockImplementation(() => mockStorageBackend);
      uploadService = new UploadService(config);
    });

    it('should upload file successfully', async () => {
      const file = { buffer: Buffer.from('test'), originalname: 'test.jpg', mimetype: 'image/jpeg' };
      const options = { path: 'portfolio' };
      const expectedResult = { filename: 'test.jpg', path: 'portfolio/test.jpg', url: '/uploads/test.jpg' };
      
      mockStorageBackend.uploadFile.mockResolvedValue(expectedResult);
      
      const result = await uploadService.uploadFile(file, options);
      
      expect(mockStorageBackend.uploadFile).toHaveBeenCalledWith(file, options);
      expect(result).toEqual({ success: true, ...expectedResult });
    });

    it('should handle upload errors', async () => {
      const file = { buffer: Buffer.from('test'), originalname: 'test.jpg', mimetype: 'image/jpeg' };
      const error = new Error('Storage error');
      
      mockStorageBackend.uploadFile.mockRejectedValue(error);
      
      await expect(uploadService.uploadFile(file)).rejects.toThrow('Upload failed: Storage error');
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      const config = { type: 'local', local: { path: 'uploads' } };
      LocalStorageBackend.mockImplementation(() => mockStorageBackend);
      uploadService = new UploadService(config);
    });

    it('should delete file successfully', async () => {
      const filePath = 'portfolio/test.jpg';
      
      mockStorageBackend.deleteFile.mockResolvedValue(true);
      
      const result = await uploadService.deleteFile(filePath);
      
      expect(mockStorageBackend.deleteFile).toHaveBeenCalledWith(filePath);
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const filePath = 'portfolio/test.jpg';
      const error = new Error('Delete error');
      
      mockStorageBackend.deleteFile.mockRejectedValue(error);
      
      await expect(uploadService.deleteFile(filePath)).rejects.toThrow('Delete failed: Delete error');
    });
  });

  describe('getFileUrl', () => {
    beforeEach(() => {
      const config = { type: 'local', local: { path: 'uploads' } };
      LocalStorageBackend.mockImplementation(() => mockStorageBackend);
      uploadService = new UploadService(config);
    });

    it('should get file URL successfully', async () => {
      const filePath = 'portfolio/test.jpg';
      const expectedUrl = '/uploads/portfolio/test.jpg';
      
      mockStorageBackend.getFileUrl.mockResolvedValue(expectedUrl);
      
      const result = await uploadService.getFileUrl(filePath);
      
      expect(mockStorageBackend.getFileUrl).toHaveBeenCalledWith(filePath);
      expect(result).toBe(expectedUrl);
    });

    it('should handle URL generation errors', async () => {
      const filePath = 'portfolio/test.jpg';
      const error = new Error('URL error');
      
      mockStorageBackend.getFileUrl.mockRejectedValue(error);
      
      await expect(uploadService.getFileUrl(filePath)).rejects.toThrow('URL generation failed: URL error');
    });
  });

  describe('fileExists', () => {
    beforeEach(() => {
      const config = { type: 'local', local: { path: 'uploads' } };
      LocalStorageBackend.mockImplementation(() => mockStorageBackend);
      uploadService = new UploadService(config);
    });

    it('should return true when file exists', async () => {
      const filePath = 'portfolio/test.jpg';
      
      mockStorageBackend.fileExists.mockResolvedValue(true);
      
      const result = await uploadService.fileExists(filePath);
      
      expect(mockStorageBackend.fileExists).toHaveBeenCalledWith(filePath);
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const filePath = 'portfolio/test.jpg';
      
      mockStorageBackend.fileExists.mockResolvedValue(false);
      
      const result = await uploadService.fileExists(filePath);
      
      expect(result).toBe(false);
    });

    it('should return false on errors', async () => {
      const filePath = 'portfolio/test.jpg';
      
      mockStorageBackend.fileExists.mockRejectedValue(new Error('Check error'));
      
      const result = await uploadService.fileExists(filePath);
      
      expect(result).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    beforeEach(() => {
      const config = { type: 'local', local: { path: 'uploads' } };
      LocalStorageBackend.mockImplementation(() => mockStorageBackend);
      uploadService = new UploadService(config);
    });

    it('should get file metadata successfully', async () => {
      const filePath = 'portfolio/test.jpg';
      const expectedMetadata = { size: 1024, lastModified: new Date() };
      
      mockStorageBackend.getFileMetadata.mockResolvedValue(expectedMetadata);
      
      const result = await uploadService.getFileMetadata(filePath);
      
      expect(mockStorageBackend.getFileMetadata).toHaveBeenCalledWith(filePath);
      expect(result).toEqual(expectedMetadata);
    });

    it('should handle metadata retrieval errors', async () => {
      const filePath = 'portfolio/test.jpg';
      const error = new Error('Metadata error');
      
      mockStorageBackend.getFileMetadata.mockRejectedValue(error);
      
      await expect(uploadService.getFileMetadata(filePath)).rejects.toThrow('Metadata retrieval failed: Metadata error');
    });
  });
});