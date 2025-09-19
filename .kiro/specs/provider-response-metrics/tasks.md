# Implementation Plan

- [x] 1. Create ResponseMetrics model and database migration







  - Create migration file for response_metrics table with proper indexes
  - Implement ResponseMetrics model with associations to User, Conversation, and Message
  - Add database indexes for efficient querying on provider_id and created_at
  - _Requirements: 2.1, 2.2, 3.3_
-

- [x] 2. Extend User model with response metric fields







  - Add migration to extend users table with metric fields (average_response_time_minutes, response_rate_percentage, metrics_last_updated)
  - Update User model definition with new fields and validation
  - Add isProvider() method to check if user role is 'provider'
  - _Requirements: 1.1, 1.2, 2.1_
-



- [x] 3. Implement ResponseMetricsService core functionality






  - Create ResponseMetricsService class with trackInitialMessage method
  - Implement trackResponse method to record provider responses
  - Write unit tests for service methods with various response scenarios
t response
  - Write unit tests for service methods with various response scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.5_


- [x] 4. Add metric calculation methods to User model






  - Implement calculateResponseMetrics method to compute average response time and response rate
  - Include logic to handle edge cases (no data, insufficient sample size)

  - Include logic to handle edge cases (no data, insufficient sample size)

  - Write unit tests for metric calculation with mock data
  - _Requirements: 2.3, 2.4, 3.2, 4.4_



- [x] 5. Integrate response tracking with message creation






  - Modify message creation logic to call ResponseMetricsService when messages are sent
  - Add logic to identify initial client messages vs provider responses
  - Ensure tracking only occurs for client-provider conversations
  - Write integration tests for message flow with metric tracking
  - _Requirements: 2.1, 2.2, 3.1_


- [x] 6. Implement metric update and caching system





  - Add updateProviderMetrics method to ResponseMetricsService

  - Implement background job or trigger to update cached metrics
  - Add logic to update metrics when new responses are recorded

  - Write tests for metric caching and update scenarios
  - _Requirements: 3.1, 3.3_

- [x] 7. Enhance profile API to include response metrics







  - Modify user profile endpoint to include response metrics 
for providers
  - Add getPublicResponseMetrics method with privacy controls
  - Format metrics for human-readable display (e.g., "2 hours", "85%")
  - Write API tests for profile endpoint with response metrics
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3_


- [x] 8. Add metric cleanup and maintenance functionality








  - Implement cleanupOldMetrics method to remove records older than 30 days
  - Add validation to ensure only providers can have response metrics
  - Create database cleanup job for maintaining performance
  - Write tests for cleanup functionality and data integrity

  - _Requirements: 3.2, 3.3_

- [x] 9. Add comprehensive error handling and validation






  - Add error handling for missing conversations or deleted messages
  - Implement validation for metric calculation edge cases
  - Add graceful fallbacks when insufficient data exists
  - Write tests for error scenarios and edge cases
  - _Requirements: 1.3, 4.4_

- [x] 10. Create integration tests for complete feature






  - Write end-to-end tests for client-provider message flow with metrics
  - Test metric display on provider profiles from client perspective
  - Verify privacy controls and role-based metric visibility
  - Test performance with realistic data volumes
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 3.1, 4.1, 4.2, 4.3, 4.4_