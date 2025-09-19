# Design Document

## Overview

The Provider Media Portfolio feature extends the existing user profile system to allow service providers to showcase their work through a collection of images. The system builds upon the current file upload infrastructure while introducing new models and services for portfolio management. The design supports both local and cloud storage configurations, with image processing capabilities for optimal web performance.

## Architecture

### High-Level Architecture

The portfolio system follows the existing MVC pattern with these key components:

- **Models**: `ProviderPortfolio` model for storing portfolio metadata
- **Services**: `portfolioService` for business logic, enhanced `uploadService` for flexible storage
- **Controllers**: `portfolioController` for HTTP request handling
- **Middleware**: Enhanced upload middleware with configurable storage backends
- **Routes**: RESTful API endpoints for portfolio management

### Storage Architecture

The system implements a pluggable storage architecture:

```
Storage Interface
├── Local Storage Implementation
└── Cloud Storage Implementation (AWS S3)
```

Configuration determines which storage backend is used at runtime, allowing seamless switching between storage methods.

## Components and Interfaces

### Database Schema

#### ProviderPortfolio Model
```javascript
{
  id: UUID (Primary Key),
  provider_id: UUID (Foreign Key to User),
  image_url: STRING (Full-size image URL/path),
  thumbnail_url: STRING (Thumbnail image URL/path),
  medium_url: STRING (Medium-size image URL/path),
  description: TEXT (Optional image description),
  display_order: INTEGER (For image ordering),
  file_size: INTEGER (Original file size in bytes),
  mime_type: STRING (Image MIME type),
  original_filename: STRING (Original uploaded filename),
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}
```

#### Associations
- `ProviderPortfolio` belongs to `User` (provider_id)
- `User` has many `ProviderPortfolio` (for providers only)

### Service Layer

#### Enhanced Upload Service
```javascript
class UploadService {
  constructor(storageConfig) {
    this.storage = this.initializeStorage(storageConfig);
  }
  
  async uploadFile(file, options) {
    // Unified interface for file upload
  }
  
  async deleteFile(filePath) {
    // Unified interface for file deletion
  }
  
  async generateImageVariants(file) {
    // Generate thumbnail, medium, and full-size versions
  }
}
```

#### Portfolio Service
```javascript
class PortfolioService {
  async addPortfolioImage(providerId, file, description) {
    // Upload image, generate variants, save to database
  }
  
  async getProviderPortfolio(providerId, includePrivate = false) {
    // Retrieve portfolio with proper privacy controls
  }
  
  async updateImageOrder(providerId, imageOrders) {
    // Update display order of images
  }
  
  async deletePortfolioImage(providerId, imageId) {
    // Remove image from storage and database
  }
}
```

### API Endpoints

#### Portfolio Management
- `POST /api/users/profile/portfolio` - Upload new portfolio image
- `GET /api/users/:userId/portfolio` - Get provider's portfolio (public)
- `GET /api/users/profile/portfolio` - Get own portfolio (private)
- `PUT /api/users/profile/portfolio/order` - Update image order
- `DELETE /api/users/profile/portfolio/:imageId` - Delete portfolio image
- `PUT /api/users/profile/portfolio/:imageId` - Update image description

### Configuration System

#### Storage Configuration
```javascript
// Environment variables
STORAGE_TYPE=local|s3
STORAGE_LOCAL_PATH=uploads/portfolio
STORAGE_S3_BUCKET=my-app-portfolio
STORAGE_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

// Upload limits
PORTFOLIO_MAX_IMAGES=10
PORTFOLIO_MAX_FILE_SIZE=5242880  // 5MB
PORTFOLIO_ALLOWED_TYPES=jpeg,jpg,png,webp
```

## Data Models

### ProviderPortfolio Entity
- **Primary Key**: UUID for scalability
- **Foreign Key**: Links to User model (provider_id)
- **Image URLs**: Separate fields for different image sizes
- **Metadata**: File information for management and display
- **Ordering**: Integer field for custom image arrangement
- **Timestamps**: Standard audit fields

### Image Processing Pipeline
1. **Upload**: Receive original image file
2. **Validation**: Check file type, size, and provider limits
3. **Processing**: Generate thumbnail (150x150), medium (400x400), and optimized full-size
4. **Storage**: Save all variants to configured storage backend
5. **Database**: Store metadata and URLs/paths
6. **Response**: Return portfolio entry with URLs

## Error Handling

### Upload Errors
- **File Type Validation**: Return 400 with specific error message
- **File Size Limits**: Return 413 with current limits information
- **Portfolio Limits**: Return 409 when maximum images reached
- **Storage Failures**: Return 500 with retry guidance
- **Processing Failures**: Store original, log error, continue with degraded functionality

### Retrieval Errors
- **Provider Not Found**: Return 404
- **Access Denied**: Return 403 for private portfolio access
- **Storage Unavailable**: Return 503 with fallback message
- **Image Not Found**: Return 404 with portfolio context

### Configuration Errors
- **Invalid Storage Config**: Fail fast at startup with clear error message
- **Missing Credentials**: Provide specific guidance for required environment variables
- **Storage Connection**: Graceful degradation with error logging

## Testing Strategy

### Unit Tests
- **Portfolio Service**: Test business logic with mocked dependencies
- **Upload Service**: Test storage abstraction with mock backends
- **Model Validation**: Test database constraints and relationships
- **Image Processing**: Test variant generation with sample images

### Integration Tests
- **API Endpoints**: Test complete request/response cycles
- **Storage Backends**: Test both local and S3 implementations
- **File Upload Flow**: Test end-to-end upload and retrieval
- **Error Scenarios**: Test various failure conditions

### Performance Tests
- **Concurrent Uploads**: Test multiple simultaneous uploads
- **Large File Handling**: Test with maximum allowed file sizes
- **Image Processing**: Measure processing time for different image sizes
- **Storage Performance**: Compare local vs cloud storage response times

### Security Tests
- **File Type Validation**: Test malicious file upload attempts
- **Access Controls**: Verify privacy controls work correctly
- **Path Traversal**: Test for directory traversal vulnerabilities
- **Rate Limiting**: Test upload rate limiting functionality

## Implementation Considerations

### Migration Strategy
1. Create ProviderPortfolio table migration
2. Add portfolio-related configuration to existing config system
3. Implement storage service abstraction
4. Build portfolio service with comprehensive error handling
5. Create API endpoints with proper validation
6. Add frontend integration points
7. Implement image processing pipeline
8. Add monitoring and logging

### Performance Optimizations
- **Lazy Loading**: Load portfolio images on demand
- **CDN Integration**: Serve images through CDN when using cloud storage
- **Image Optimization**: Compress images during processing
- **Caching**: Cache portfolio metadata and image URLs
- **Pagination**: Support pagination for providers with many images

### Security Measures
- **File Validation**: Strict MIME type and extension checking
- **Size Limits**: Configurable per-file and per-provider limits
- **Access Controls**: Proper authentication and authorization
- **Sanitization**: Clean file names and descriptions
- **Rate Limiting**: Prevent abuse of upload endpoints

### Scalability Considerations
- **Storage Abstraction**: Easy switching between storage backends
- **Database Indexing**: Proper indexes on provider_id and display_order
- **Async Processing**: Background image processing for large files
- **Horizontal Scaling**: Stateless service design for multiple instances