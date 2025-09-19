const fs = require('fs').promises;
const path = require('path');
const LocalStorageBackend = require('../services/storage/LocalStorageBackend');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mocked-uuid-1234')
}));

describe('LocalStorageBackend', () => {
  let backend;
  const mockConfig = { path: 'uploads/test' };

  beforeEach(() => {
    jest.clearAllMocks();
    backend = new LocalStorageBackend(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(backend.basePath).toBe('uploads/test');
    });

    it('should use default path if not provided', () => {
      const backendWithDefaults = new LocalStorageBackend({});
      expect(backendWithDefaults.basePath).toBe('uploads/portfolio');
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should not create directory if it exists', async () => {
      fs.access.mockResolvedValue();
      
      await backend.ensureDirectoryExists();
      
      expect(fs.access).toHaveBeenCalledWith('uploads/test');
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      fs.mkdir.mockResolvedValue();
      
      await backend.ensureDirectoryExists();
      
      expect(fs.access).toHaveBeenCalledWith('uploads/test');
      expect(fs.mkdir).toHaveBeenCalledWith('uploads/test', { recursive: true });
    });
  });

  describe('uploadFile', () => {
    const mockFile = {
      buffer: Buffer.from('test content'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg'
    };

    beforeEach(() => {
      fs.access.mockResolvedValue(); // Directory exists
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: 12 });
    });

    it('should upload file with generated filename', async () => {
      const result = await backend.uploadFile(mockFile);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('uploads/test', 'mocked-uuid-1234.jpg'),
        mockFile.buffer
      );
      expect(result).toEqual({
        filename: 'mocked-uuid-1234.jpg',
        path: 'mocked-uuid-1234.jpg',
        fullPath: path.join('uploads/test', 'mocked-uuid-1234.jpg'),
        size: 12,
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        url: '/uploads/portfolio/mocked-uuid-1234.jpg'
      });
    });

    it('should upload file with custom filename', async () => {
      const options = { filename: 'custom.jpg' };
      
      const result = await backend.uploadFile(mockFile, options);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('uploads/test', 'custom.jpg'),
        mockFile.buffer
      );
      expect(result.filename).toBe('custom.jpg');
    });

    it('should upload file with custom path', async () => {
      const options = { path: 'subfolder' };
      
      const result = await backend.uploadFile(mockFile, options);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('uploads/test', 'subfolder'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('uploads/test', 'subfolder', 'mocked-uuid-1234.jpg'),
        mockFile.buffer
      );
      expect(result.path).toBe(path.join('subfolder', 'mocked-uuid-1234.jpg'));
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      fs.unlink.mockResolvedValue();
      
      const result = await backend.deleteFile('test.jpg');
      
      expect(fs.unlink).toHaveBeenCalledWith(path.join('uploads/test', 'test.jpg'));
      expect(result).toBe(true);
    });

    it('should return true if file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.unlink.mockRejectedValue(error);
      
      const result = await backend.deleteFile('test.jpg');
      
      expect(result).toBe(true);
    });

    it('should throw error for other delete failures', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.unlink.mockRejectedValue(error);
      
      await expect(backend.deleteFile('test.jpg')).rejects.toThrow('Permission denied');
    });
  });

  describe('getFileUrl', () => {
    it('should return public URL for file', async () => {
      const result = await backend.getFileUrl('test.jpg');
      
      expect(result).toBe('/uploads/portfolio/test.jpg');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      fs.access.mockResolvedValue();
      
      const result = await backend.fileExists('test.jpg');
      
      expect(fs.access).toHaveBeenCalledWith(path.join('uploads/test', 'test.jpg'));
      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      
      const result = await backend.fileExists('test.jpg');
      
      expect(result).toBe(false);
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01'),
        birthtime: new Date('2023-01-01')
      };
      fs.stat.mockResolvedValue(mockStats);
      
      const result = await backend.getFileMetadata('test.jpg');
      
      expect(fs.stat).toHaveBeenCalledWith(path.join('uploads/test', 'test.jpg'));
      expect(result).toEqual({
        size: 1024,
        lastModified: mockStats.mtime,
        created: mockStats.birthtime,
        path: 'test.jpg',
        fullPath: path.join('uploads/test', 'test.jpg')
      });
    });

    it('should throw error if file stat fails', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      
      await expect(backend.getFileMetadata('test.jpg')).rejects.toThrow('File not found');
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

  describe('getPublicUrl', () => {
    it('should return public URL for local files', () => {
      const result = backend.getPublicUrl('test.jpg');
      
      expect(result).toBe('/uploads/portfolio/test.jpg');
    });
  });
});