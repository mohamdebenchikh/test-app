# Implementation Plan

- [x] 1. Database schema updates and migrations


  - Create migration to add presence fields to User model (online_status, last_activity, show_online_status, custom_status_message)
  - Create UserSession model with migration for tracking active sessions
  - Add database indexes for performance optimization on presence queries
  - _Requirements: 1.1, 1.5, 3.1, 3.3_

- [x] 2. Extend User model with presence functionality


  - Add presence fields to User model definition
  - Implement getPresenceInfo(), isOnline(), getLastSeenText(), and canShowPresence() methods
  - Create UserSession model with associations to User model
  - Write unit tests for User model presence methods
  - _Requirements: 1.1, 1.5, 3.1_

- [x] 3. Create core PresenceService



  - Implement PresenceService class with setUserOnline(), setUserOffline(), updateLastActivity() methods
  - Add getUserPresence(), getOnlineProviders(), setCustomStatus() methods
  - Implement cleanupInactiveSessions() for maintenance
  - Write unit tests for all PresenceService methods
  - _Requirements: 1.1, 1.2, 1.5, 3.1, 3.2, 3.3, 3.4_

- [x] 4. Enhance Socket.IO service with presence tracking



  - Modify existing socket.service.js to integrate presence tracking on connection/disconnection
  - Add socket event handlers for 'activity', 'setStatus', and presence updates
  - Implement real-time presence broadcasting to relevant users
  - Add error handling for socket presence operations
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3_

- [x] 5. Create presence API endpoints



  - Implement GET /api/users/presence/:userId endpoint to get user presence
  - Create PATCH /api/users/presence/status endpoint for updating own status
  - Add GET /api/users/presence/settings and PATCH /api/users/presence/settings endpoints
  - Write validation schemas for presence API requests
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Enhance provider filtering with presence data



  - Modify existing provider routes to include presence information in responses
  - Add query parameters for filtering by online_status, last_seen, and active_within
  - Update provider service methods to handle presence-based filtering
  - Optimize database queries for presence filtering performance
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Add activity tracking middleware




  - Create middleware to automatically update last_activity on API requests
  - Integrate activity tracking middleware into existing route handlers
  - Add rate limiting to prevent excessive activity updates
  - Write tests for activity tracking middleware
  - _Requirements: 1.2, 6.2_

- [x] 8. Implement presence broadcasting system





  - Create utility functions for broadcasting presence updates to relevant users
  - Add presence update events to chat system for real-time status in conversations
  - Implement typing indicators for chat conversations
  - Add presence information to existing notification system
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 9. Add presence privacy controls





  - Implement privacy settings validation and enforcement
  - Create logic for hiding exact timestamps when privacy is enabled
  - Add "Do Not Disturb" and "Away" status handling
  - Write tests for privacy control functionality
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 10. Create session cleanup and maintenance tasks







  - Implement automated cleanup of inactive sessions
  - Add scheduled task for removing old session data
  - Create monitoring for concurrent user sessions
  - Add logging and metrics for presence system performance
  - _Requirements: 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Write comprehensive tests for presence system




  - Create integration tests for Socket.IO presence tracking
  - Write API endpoint tests for all presence routes
  - Add tests for provider filtering with presence data
  - Create performance tests for concurrent user presence updates
  - _Requirements: All requirements validation_

- [x] 12. Update existing chat system with presence integration









  - Modify chat routes to include presence information in conversation data
  - Add real-time presence updates to active chat conversations
  - Implement typing indicators using Socket.IO events
  - Update chat UI data structures to include presence information
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_