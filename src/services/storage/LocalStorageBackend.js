const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Local file system storage backend
 * Handles file operations on the local file system
 */
class LocalStorageBackend {
  constructor(config) {
    this.basePath = config.path || 'uploads/portfolio';
    this.ensureDirectoryExists();
  }

  /**
   * Ensure the base directory exists
   */
  async ensureDirectoryExists() {
    try {
      await fs.access(this.basePath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.basePath, { recursive: true });
    }
  }

  /**
   * Upload a file to local storage
   * @param {Object} file - File object with buffer, originalname, mimetype
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, options = {}) {
    await this.ensureDirectoryExists();

    const filename = options.filename || this.generateFilename(file.originalname);
    const relativePath = options.path ? path.join(options.path, filename) : filename;
    const fullPath = path.join(this.basePath, relativePath);
    
    // Ensure subdirectory exists if specified
    const directory = path.dirname(fullPath);
    await fs.mkdir(directory, { recursive: true });

    // Write file to disk
    await fs.writeFile(fullPath, file.buffer);

    // Get file stats
    const stats = await fs.stat(fullPath);

    return {
      filename,
      path: relativePath,
      fullPath,
      size: stats.size,
      mimetype: file.mimetype,
      originalname: file.originalname,
      url: this.getPublicUrl(relativePath)
    };
  }

  /**
   * Delete a file from local storage
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filePath) {
    try {
      const fullPath = path.join(this.basePath, filePath);
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, consider it successfully deleted
        return true;
      }
      throw error;
    }
  }

  /**
   * Get public URL for a file
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<string>} Public URL
   */
  async getFileUrl(filePath) {
    return this.getPublicUrl(filePath);
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      const fullPath = path.join(this.basePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata
   * @param {string} filePath - Relative path to the file
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(filePath) {
    const fullPath = path.join(this.basePath, filePath);
    const stats = await fs.stat(fullPath);
    
    return {
      size: stats.size,
      lastModified: stats.mtime,
      created: stats.birthtime,
      path: filePath,
      fullPath
    };
  }

  /**
   * Generate a unique filename
   * @param {string} originalName - Original filename
   * @returns {string} Generated filename
   */
  generateFilename(originalName) {
    const ext = path.extname(originalName);
    const uuid = crypto.randomUUID();
    return `${uuid}${ext}`;
  }

  /**
   * Get public URL for local files
   * @param {string} filePath - Relative path to the file
   * @returns {string} Public URL
   */
  getPublicUrl(filePath) {
    // For local storage, return a relative URL that can be served by the web server
    return `/uploads/portfolio/${filePath}`;
  }
}

module.exports = LocalStorageBackend;