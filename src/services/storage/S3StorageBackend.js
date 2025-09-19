const AWS = require('aws-sdk');
const crypto = require('crypto');
const path = require('path');

/**
 * AWS S3 storage backend
 * Handles file operations with Amazon S3
 */
class S3StorageBackend {
  constructor(config) {
    this.config = config;
    this.bucket = config.bucket;
    
    // Initialize S3 client
    this.s3 = new AWS.S3({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region
    });
  }

  /**
   * Upload a file to S3
   * @param {Object} file - File object with buffer, originalname, mimetype
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, options = {}) {
    const filename = options.filename || this.generateFilename(file.originalname);
    const key = options.path ? `${options.path}/${filename}` : filename;

    const uploadParams = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read' // Make files publicly accessible
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();
      
      return {
        filename,
        path: key,
        key: result.Key,
        size: file.buffer.length,
        mimetype: file.mimetype,
        originalname: file.originalname,
        url: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(key) {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key
      }).promise();
      
      return true;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        // Object doesn't exist, consider it successfully deleted
        return true;
      }
      throw error;
    }
  }

  /**
   * Get public URL for an S3 object
   * @param {string} key - S3 object key
   * @returns {Promise<string>} Public URL
   */
  async getFileUrl(key) {
    // For public objects, construct the URL directly
    return `https://${this.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Get signed URL for private access (alternative method)
   * @param {string} key - S3 object key
   * @param {number} expires - URL expiration in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expires = 3600) {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expires
    });
  }

  /**
   * Check if a file exists in S3
   * @param {string} key - S3 object key
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(key) {
    try {
      await this.s3.headObject({
        Bucket: this.bucket,
        Key: key
      }).promise();
      
      return true;
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(key) {
    try {
      const result = await this.s3.headObject({
        Bucket: this.bucket,
        Key: key
      }).promise();

      return {
        size: result.ContentLength,
        lastModified: result.LastModified,
        contentType: result.ContentType,
        etag: result.ETag,
        key: key,
        metadata: result.Metadata || {}
      };
    } catch (error) {
      throw new Error(`Failed to get S3 metadata: ${error.message}`);
    }
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
   * List objects in S3 bucket with prefix
   * @param {string} prefix - Object key prefix
   * @param {number} maxKeys - Maximum number of keys to return
   * @returns {Promise<Array>} Array of object metadata
   */
  async listFiles(prefix = '', maxKeys = 1000) {
    try {
      const result = await this.s3.listObjectsV2({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      }).promise();

      return result.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      }));
    } catch (error) {
      throw new Error(`Failed to list S3 objects: ${error.message}`);
    }
  }
}

module.exports = S3StorageBackend;