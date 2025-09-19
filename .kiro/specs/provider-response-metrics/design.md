# Design Document

## Overview

This feature adds response metrics tracking to provider profiles by extending the existing User model and leveraging the current Message and Conversation models. The system will calculate and display average response time and response rate for providers, helping clients make informed decisions when choosing service providers.

The solution integrates with the existing messaging system without requiring major architectural changes, using computed fields and database views for efficient metric calculation.

## Architecture

### Data Flow
1. **Message Tracking**: When messages are sent/received, the system tracks response patterns
2. **Metric Calculation**: Response metrics are calculated using database aggregations
3. **Profile Display**: Metrics are displayed on provider profiles with appropriate privacy controls
4. **Real-time Updates**: Metrics are updated when new responses occur

### Integration Points
- **User Model**: Extended with response metric fields and calculation methods
- **Message Model**: Enhanced to support response time tracking
- **Profile Views**: Updated to display response metrics for providers
- **Database**: New tables/fields for efficient metric storage and calculation

## Components and Interfaces

### 1. Database Schema Extensions

#### New Table: ResponseMetrics
```sql
CREATE TABLE response_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES users(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  initial_message_id UUID NOT NULL REFERENCES messages(id),
  response_message_id UUID REFERENCES messages(id),
  response_time_minutes INTEGER,
  responded_within_24h BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### User Model Extensions
```javascript
// New fields added to User model
average_response_time_minutes: {
  type: DataTypes.INTEGER,
  allowNull: true,
  comment: 'Cached average response time in minutes'
},
response_rate_percentage: {
  type: DataTypes.DECIMAL(5,2),
  allowNull: true,
  comment: 'Cached response rate as percentage'
},
metrics_last_updated: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: 'When metrics were last calculated'
}
```

### 2. Service Layer

#### ResponseMetricsService
```javascript
class ResponseMetricsService {
  // Track when a conversation starts (first message from client to provider)
  async trackInitialMessage(messageId, conversationId, senderId, receiverId)
  
  // Track when provider responds to client message
  async trackResponse(messageId, conversationId, senderId, receiverId)
  
  // Calculate and update provider metrics
  async updateProviderMetrics(providerId)
  
  // Get formatted metrics for display
  async getProviderMetrics(providerId)
  
  // Clean up old metric records (older than 30 days)
  async cleanupOldMetrics()
}
```

### 3. User Model Methods

#### New Methods Added to User Model
```javascript
// Calculate response metrics for this provider
async calculateResponseMetrics()

// Get formatted response metrics for display
async getResponseMetrics()

// Check if user is a provider (for metric display)
isProvider()

// Get response metrics with privacy controls
getPublicResponseMetrics()
```

### 4. API Endpoints

#### GET /api/users/:id/profile
Enhanced to include response metrics for providers:
```javascript
{
  // ... existing user profile data
  responseMetrics: {
    averageResponseTime: "2 hours 30 minutes",
    responseRate: "85%",
    basedOnDays: 30,
    sampleSize: 15,
    lastUpdated: "2024-01-15T10:30:00Z"
  }
}
```

## Data Models

### ResponseMetric Model
```javascript
{
  id: UUID,
  provider_id: UUID,
  conversation_id: UUID,
  initial_message_id: UUID,
  response_message_id: UUID (nullable),
  response_time_minutes: INTEGER (nullable),
  responded_within_24h: BOOLEAN,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### User Model Extensions
```javascript
{
  // ... existing fields
  average_response_time_minutes: INTEGER (nullable),
  response_rate_percentage: DECIMAL(5,2) (nullable),
  metrics_last_updated: DATE (nullable)
}
```

### Metric Calculation Logic

#### Response Time Calculation
- Track time between client's initial message and provider's first response
- Only count responses within 7 days of initial message
- Calculate average over last 30 days of activity
- Store in minutes for precision, display in human-readable format

#### Response Rate Calculation
- Count conversations where provider responded within 24 hours
- Calculate as percentage of total conversations initiated by clients
- Based on last 30 days of activity
- Minimum 3 conversations required for display

## Error Handling

### Data Integrity
- Validate that only provider users can have response metrics
- Handle cases where conversations or messages are deleted
- Graceful degradation when insufficient data exists

### Performance Considerations
- Cache calculated metrics in User model to avoid real-time calculations
- Update metrics asynchronously when new responses occur
- Use database indexes on frequently queried fields
- Implement cleanup job for old metric records

### Privacy and Security
- Only display metrics for users with role 'provider'
- Respect user privacy settings for profile visibility
- Don't expose raw response data, only aggregated metrics
- Handle edge cases where providers have no message history

## Testing Strategy

### Unit Tests
- ResponseMetricsService methods
- User model metric calculation methods
- Metric formatting and display logic
- Privacy controls for metric visibility

### Integration Tests
- End-to-end message flow with metric tracking
- API endpoints returning provider profiles with metrics
- Database operations for metric calculation and storage
- Performance testing with large datasets

### Test Scenarios
- Provider with no message history
- Provider with recent activity only
- Provider with mixed response patterns
- Client viewing provider profile
- Provider viewing their own metrics
- System performance with high message volume

### Mock Data Requirements
- Sample conversations between clients and providers
- Various response time patterns (quick, slow, no response)
- Different time periods for metric calculation testing
- Edge cases (deleted messages, inactive users)

## Implementation Phases

### Phase 1: Core Infrastructure
- Create ResponseMetrics table and model
- Extend User model with metric fields
- Implement basic ResponseMetricsService

### Phase 2: Metric Calculation
- Implement message tracking logic
- Add metric calculation methods
- Create background job for metric updates

### Phase 3: Display Integration
- Update profile API to include metrics
- Add frontend display components
- Implement privacy controls

### Phase 4: Optimization
- Add caching and performance optimizations
- Implement cleanup jobs
- Add comprehensive monitoring