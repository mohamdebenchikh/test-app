# User Presence System Design

## Overview

The User Presence System will track and display real-time online status for users in the marketplace platform. The system will leverage the existing Socket.IO infrastructure to provide real-time presence updates, extend the current User model to include presence fields, and add filtering capabilities to help clients find active providers.

## Architecture

### High-Level Components

1. **Presence Tracking Service** - Manages user online/offline status
2. **Socket.IO Integration** - Real-time presence updates via WebSocket
3. **Database Layer** - Extended User model with presence fields
4. **API Endpoints** - REST endpoints for presence management and filtering
5. **Middleware** - Authentication and presence update middleware

### Data Flow

```
Client Connection → Socket.IO → Presence Service → Database Update → Broadcast to Relevant Users
```

## Components and Interfaces

### 1. Database Schema Extensions

#### User Model Extensions
```javascript
// Additional fields to existing User model
{
  online_status: {
    type: DataTypes.ENUM('online', 'offline', 'away', 'dnd'),
    defaultValue: 'offline'
  },
  last_activity: {
    type: DataTypes.DATE,
    allowNull: true
  },
  show_online_status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  custom_status_message: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}
```

#### UserSession Model (New)
```javascript
// Track active sessions for multi-device support
{
  id: UUID (Primary Key),
  user_id: UUID (Foreign Key to User),
  socket_id: STRING,
  device_type: ENUM('web', 'mobile', 'desktop'),
  ip_address: STRING,
  user_agent: STRING,
  connected_at: DATE,
  last_ping: DATE,
  is_active: BOOLEAN
}
```

### 2. Presence Service

#### Core Functions
```javascript
class PresenceService {
  // Update user online status
  async setUserOnline(userId, socketId, deviceInfo)
  
  // Update user offline status
  async setUserOffline(userId, socketId)
  
  // Update last activity timestamp
  async updateLastActivity(userId)
  
  // Get user's current online status
  async getUserPresence(userId)
  
  // Get online users in a city/service
  async getOnlineProviders(cityId, serviceId, filters)
  
  // Set custom status (away, dnd, custom message)
  async setCustomStatus(userId, status, message)
  
  // Clean up inactive sessions
  async cleanupInactiveSessions()
}
```

### 3. Socket.IO Integration

#### Enhanced Socket Events
```javascript
// Existing connection handling + presence tracking
io.on('connection', (socket) => {
  // Set user online
  presenceService.setUserOnline(socket.user.id, socket.id, deviceInfo);
  
  // Broadcast presence update
  socket.broadcast.emit('userOnline', {
    userId: socket.user.id,
    status: 'online'
  });
  
  // Handle activity updates
  socket.on('activity', () => {
    presenceService.updateLastActivity(socket.user.id);
  });
  
  // Handle custom status
  socket.on('setStatus', (data) => {
    presenceService.setCustomStatus(socket.user.id, data.status, data.message);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    presenceService.setUserOffline(socket.user.id, socket.id);
  });
});
```

### 4. API Endpoints

#### Presence Management Routes
```javascript
// GET /api/users/presence/:userId - Get user presence
// PATCH /api/users/presence/status - Update own status
// GET /api/users/presence/settings - Get presence settings
// PATCH /api/users/presence/settings - Update presence settings
```

#### Provider Filtering Enhancement
```javascript
// GET /api/providers?online_status=online
// GET /api/providers?last_seen=1h
// GET /api/providers?active_within=24h
```

### 5. Middleware Components

#### Activity Tracking Middleware
```javascript
const trackActivity = (req, res, next) => {
  if (req.user) {
    presenceService.updateLastActivity(req.user.id);
  }
  next();
};
```

#### Presence Broadcasting Middleware
```javascript
const broadcastPresence = (userId, status) => {
  io.emit('presenceUpdate', {
    userId,
    status,
    timestamp: new Date()
  });
};
```

## Data Models

### Extended User Model
```javascript
User {
  // Existing fields...
  online_status: 'online' | 'offline' | 'away' | 'dnd',
  last_activity: Date,
  show_online_status: boolean,
  custom_status_message: string,
  
  // Methods
  getPresenceInfo(): PresenceInfo,
  isOnline(): boolean,
  getLastSeenText(): string,
  canShowPresence(): boolean
}
```

### UserSession Model
```javascript
UserSession {
  id: UUID,
  user_id: UUID,
  socket_id: string,
  device_type: 'web' | 'mobile' | 'desktop',
  ip_address: string,
  user_agent: string,
  connected_at: Date,
  last_ping: Date,
  is_active: boolean
}
```

### Presence Response DTOs
```javascript
PresenceInfo {
  userId: UUID,
  online_status: string,
  last_seen: Date,
  custom_message?: string,
  show_status: boolean
}

ProviderWithPresence {
  // Existing provider fields...
  presence: PresenceInfo,
  is_online: boolean,
  last_seen_text: string
}
```

## Error Handling

### Presence Service Errors
- **Connection Timeout**: Handle socket disconnections gracefully
- **Database Failures**: Fallback to cached presence data
- **Invalid Status**: Validate status enum values
- **Permission Denied**: Respect privacy settings

### Socket.IO Error Handling
```javascript
socket.on('error', (error) => {
  logger.error('Socket presence error:', error);
  // Attempt to recover connection
  presenceService.handleSocketError(socket.user.id, error);
});
```

## Testing Strategy

### Unit Tests
- PresenceService methods
- User model presence methods
- Socket event handlers
- API endpoint responses

### Integration Tests
- Socket.IO connection and disconnection flows
- Real-time presence updates
- Provider filtering with presence data
- Multi-device session handling

### Performance Tests
- Concurrent user connections
- Presence update broadcast performance
- Database query optimization for presence filtering
- Memory usage with large user sessions

## Implementation Considerations

### Performance Optimizations
1. **Redis Integration**: Cache active user sessions and presence data
2. **Database Indexing**: Index on online_status, last_activity, and city_id
3. **Batch Updates**: Group presence updates to reduce database calls
4. **Connection Pooling**: Optimize Socket.IO connection handling

### Privacy & Security
1. **Privacy Settings**: Respect user preferences for showing online status
2. **Rate Limiting**: Prevent spam presence updates
3. **Session Validation**: Verify socket connections belong to authenticated users
4. **Data Retention**: Clean up old session data regularly

### Scalability Considerations
1. **Horizontal Scaling**: Design for multiple server instances
2. **Load Balancing**: Handle Socket.IO sticky sessions
3. **Database Sharding**: Consider user-based sharding for large scale
4. **CDN Integration**: Cache presence data at edge locations

### Migration Strategy
1. **Database Migration**: Add new fields to User table
2. **Backward Compatibility**: Ensure existing API endpoints continue working
3. **Gradual Rollout**: Feature flags for presence system activation
4. **Data Backfill**: Set initial presence data for existing users