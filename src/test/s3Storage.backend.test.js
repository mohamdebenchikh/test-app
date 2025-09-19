const AWS = require('aws-sdk');
const S3StorageBackend = require('../services/storage/S3StorageBackend');

// Mock AWS SDK
jest.mock('aws-sdk');

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mocked-uuid-1234')
}));

describe('S3StorageBackend', () => {
  let backend;
  let mockS3;
  let mockUpload, mockDeleteObject, mockHeadObject, mockListObjectsV2;
  const mockConfig = {
    bucket: 'test-bucket',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock promise functions
    mockUpload = jest.fn();
    mockDeleteObject = jest.fn();
    mockHeadObject = jest.fn();
    mockListObjectsV2 = jest.fn();
    
    mockS3 = {
      upload: jest.fn(() => ({ promise: mockUpload })),
      deleteObject: jest.fn(() => ({ promise: mockDeleteObject })),
      headObject: jest.fn(() => ({ promise: mockHeadObject })),
      listObjectsV2: jest.fn(() => ({ promise: mockListObjectsV2 })),
      getSignedUrl: jest.fn()
    };
    
    AWS.S3.mockImplementation(() => mockS3);
    
    backend = new S3StorageBackend(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize S3 client with config', () => {
      expect(AWS.S3).toHaveBeenCalledWith({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        region: 'us-east-1'
      });
      expect(backend.bucket).toBe('test-bucket');
      expect(backend.s3).toBe(mockS3);
    });
  });

  describe('uploadFile', () => {
    const mockFile = {
      buffer: Buffer.from('test content'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg'
    };

    it('should upload file with generated filename', async () => {
      const mockResult = {
        Key: 'mocked-uuid-1234.jpg',
        Location: 'https://test-bucket.s3.amazonaws.com/mocked-uuid-1234.jpg',
        ETag: '"abc123"'
      };
      mockUpload.mockResolvedValue(mockResult);
      
      const result = await backend.uploadFile(mockFile);
      
      expect(mockS3.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'mocked-uuid-1234.jpg',
        Body: mockFile.buffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      });
      
      expect(result).toEqual({
        filename: 'mocked-uuid-1234.jpg',
        path: 'mocked-uuid-1234.jpg',
        key: 'mocked-uuid-1234.jpg',
        size: mockFile.buffer.length,
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        url: 'https://test-bucket.s3.amazonaws.com/mocked-uuid-1234.jpg',
        etag: '"abc123"'
      });
    });

    it('should upload file with custom filename and path', async () => {
      const options = { filename: 'custom.jpg', path: 'portfolio' };
      const mockResult = {
        Key: 'portfolio/custom.jpg',
        Location: 'https://test-bucket.s3.amazonaws.com/portfolio/custom.jpg',
        ETag: '"abc123"'
      };
      mockUpload.mockResolvedValue(mockResult);
      
      const result = await backend.uploadFile(mockFile, options);
      
      expect(mockS3.upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'portfolio/custom.jpg',
        Body: mockFile.buffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      });
      
      expect(result.filename).toBe('custom.jpg');
      expect(result.path).toBe('portfolio/custom.jpg');
    });

    it('should handle upload errors', async () => {
      mockUpload.mockRejectedValue(new Error('Upload failed'));
      
      await expect(backend.uploadFile(mockFile)).rejects.toThrow('S3 upload failed: Upload failed');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockDeleteObject.mockResolvedValue({});
      
      const result = await backend.deleteFile('test.jpg');
      
      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg'
      });
      expect(result).toBe(true);
    });

    it('should return true if object does not exist', async () => {
      const error = new Error('Not found');
      error.code = 'NoSuchKey';
      mockDeleteObject.mockRejectedValue(error);
      
      const result = await backend.deleteFile('test.jpg');
      
      expect(result).toBe(true);
    });

    it('should throw error for other delete failures', async () => {
      const error = new Error('Access denied');
      error.code = 'AccessDenied';
      mockDeleteObject.mockRejectedValue(error);
      
      await expect(backend.deleteFile('test.jpg')).rejects.toThrow('Access denied');
    });
  });

  describe('getFileUrl', () => {
    it('should return public URL for S3 object', async () => {
      const result = await backend.getFileUrl('test.jpg');
      
      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test.jpg');
    });
  });

  describe('getSignedUrl', () => {
    it('should return signed URL with default expiration', async () => {
      const signedUrl = 'https://signed-url.com';
      mockS3.getSignedUrl.mockReturnValue(signedUrl);
      
      const result = await backend.getSignedUrl('test.jpg');
      
      expect(mockS3.getSignedUrl).toHaveBeenCalledWith('getObject', {
        Bucket: 'test-bucket',
        Key: 'test.jpg',
        Expires: 3600
      });
      expect(result).toBe(signedUrl);
    });

    it('should return signed URL with custom expiration', async () => {
      const signedUrl = 'https://signed-url.com';
      mockS3.getSignedUrl.mockReturnValue(signedUrl);
      
      const result = await backend.getSignedUrl('test.jpg', 7200);
      
      expect(mockS3.getSignedUrl).toHaveBeenCalledWith('getObject', {
        Bucket: 'test-bucket',
        Key: 'test.jpg',
        Expires: 7200
      });
      expect(result).toBe(signedUrl);
    });
  });

  describe('fileExists', () => {
    it('should return true if object exists', async () => {
      mockHeadObject.mockResolvedValue({});
      
      const result = await backend.fileExists('test.jpg');
      
      expect(mockS3.headObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg'
      });
      expect(result).toBe(true);
    });

    it('should return false if object does not exist', async () => {
      const error = new Error('Not found');
      error.code = 'NotFound';
      mockHeadObject.mockRejectedValue(error);
      
      const result = await backend.fileExists('test.jpg');
      
      expect(result).toBe(false);
    });

    it('should return false for NoSuchKey error', async () => {
      const error = new Error('No such key');
      error.code = 'NoSuchKey';
      mockHeadObject.mockRejectedValue(error);
      
      const result = await backend.fileExists('test.jpg');
      
      expect(result).toBe(false);
    });

    it('should throw error for other failures', async () => {
      const error = new Error('Access denied');
      error.code = 'AccessDenied';
      mockHeadObject.mockRejectedValue(error);
      
      await expect(backend.fileExists('test.jpg')).rejects.toThrow('Access denied');
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const mockMetadata = {
        ContentLength: 1024,
        LastModified: new Date('2023-01-01'),
        ContentType: 'image/jpeg',
        ETag: '"abc123"',
        Metadata: { custom: 'value' }
      };
      mockHeadObject.mockResolvedValue(mockMetadata);
      
      const result = await backend.getFileMetadata('test.jpg');
      
      expect(mockS3.headObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test.jpg'
      });
      
      expect(result).toEqual({
        size: 1024,
        lastModified: mockMetadata.LastModified,
        contentType: 'image/jpeg',
        etag: '"abc123"',
        key: 'test.jpg',
        metadata: { custom: 'value' }
      });
    });

    it('should handle metadata retrieval errors', async () => {
      mockHeadObject.mockRejectedValue(new Error('Access denied'));
      
      await expect(backend.getFileMetadata('test.jpg')).rejects.toThrow('Failed to get S3 metadata: Access denied');
    });
  });

  describe('listFiles', () => {
    it('should list files with default parameters', async () => {
      const mockResponse = {
        Contents: [
          {
            Key: 'file1.jpg',
            Size: 1024,
            LastModified: new Date('2023-01-01'),
            ETag: '"abc123"'
          },
          {
            Key: 'file2.jpg',
            Size: 2048,
            LastModified: new Date('2023-01-02'),
            ETag: '"def456"'
          }
        ]
      };
      mockListObjectsV2.mockResolvedValue(mockResponse);
      
      const result = await backend.listFiles();
      
      expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: '',
        MaxKeys: 1000
      });
      
      expect(result).toEqual([
        {
          key: 'file1.jpg',
          size: 1024,
          lastModified: new Date('2023-01-01'),
          etag: '"abc123"'
        },
        {
          key: 'file2.jpg',
          size: 2048,
          lastModified: new Date('2023-01-02'),
          etag: '"def456"'
        }
      ]);
    });

    it('should list files with custom parameters', async () => {
      const mockResponse = { Contents: [] };
      mockListObjectsV2.mockResolvedValue(mockResponse);
      
      await backend.listFiles('portfolio/', 100);
      
      expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Prefix: 'portfolio/',
        MaxKeys: 100
      });
    });

    it('should handle list errors', async () => {
      mockListObjectsV2.mockRejectedValue(new Error('List failed'));
      
      await expect(backend.listFiles()).rejects.toThrow('Failed to list S3 objects: List failed');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with UUID and original extension', () => {
      const result = backend.generateFilename('test.jpg');
      
      expect(result).toBe('mocked-uuid-1234.jpg');
    });

    it('should handle files without extension', () => {
      const result = backend.generateFilename('test');
      
      expect(result).toBe('mocked-uuid-1234');
    });
  });
});