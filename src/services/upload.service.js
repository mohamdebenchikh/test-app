const config = require('../config/config');
const LocalStorageBackend = require('./storage/LocalStorageBackend');
const S3StorageBackend = require('./storage/S3StorageBackend');

/**
 * Upload service with pluggable storage backends
 * Provides unified interface for file operations regardless of storage type
 */
class UploadService {
  constructor(storageConfig = config.portfolio.storage) {
    this.config = storageConfig;
    this.storage = this.initializeStorage(storageConfig);
  }

  /**
   * Initialize storage backend based on configuration
   * @param {Object} storageConfig - Storage configuration
   * @returns {Object} Storage backend instance
   */
  initializeStorage(storageConfig) {
    switch (storageConfig.type) {
      case 'local':
        return new LocalStorageBackend(storageConfig.local);
      case 's3':
        return new S3StorageBackend(storageConfig.s3);
      default:
        throw new Error(`Unsupported storage type: ${storageConfig.type}`);
    }
  }

  /**
   * Upload a file using the configured storage backend
   * @param {Object} file - File object with buffer, originalname, mimetype
   * @param {Object} options - Upload options (path, filename, etc.)
   * @returns {Promise<Object>} Upload result with file metadata
   */
  async uploadFile(file, options = {}) {
    try {
      const result = await this.storage.uploadFile(file, options);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a file using the configured storage backend
   * @param {string} filePath - Path or key of the file to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filePath) {
    try {
      return await this.storage.deleteFile(filePath);
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get public URL for a file
   * @param {string} filePath - Path or key of the file
   * @returns {Promise<string>} Public URL for the file
   */
  async getFileUrl(filePath) {
    try {
      return await this.storage.getFileUrl(filePath);
    } catch (error) {
      throw new Error(`URL generation failed: ${error.message}`);
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path or key of the file
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      return await this.storage.fileExists(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   * @param {string} filePath - Path or key of the file
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(filePath) {
    try {
      return await this.storage.getFileMetadata(filePath);
    } catch (error) {
      throw new Error(`Metadata retrieval failed: ${error.message}`);
    }
  }
}

module.exports = UploadService;