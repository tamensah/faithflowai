# TypeScript Error Fix Roadmap

## Overview
This document outlines the systematic approach to fixing TypeScript errors in the FaithFlow project, following the guidelines in `TYPESCRIPT_STRUCTURE.md`.

## Phase 1: Type Definitions
**Priority: HIGH**
**Status: COMPLETED**

### Base Types and DTOs
- [x] Update `types/auth.ts`:
  - [x] Fix AuthenticatedRequest interface inheritance
  - [x] Add WebAuthn-specific types
  - [x] Update OrganizationDTO with proper ChurchStatus enum
  - [x] Complete SecuritySettingsDTO definition
  - [x] Add PasskeyDTO and ChallengeVerificationDTO
  - [x] Add AuditLogDTO for tracking user actions

### Service Interfaces
- [x] Define IAuthService interface
- [x] Define IPlatformService interface
- [x] Define IOrganizationService interface
- [x] Define ISubscriptionService interface

### Request/Response Types
- [x] Add proper error response types
- [x] Define validation schema types
- [x] Add WebAuthn request/response types

## Phase 2: Middleware Types
**Priority: HIGH**
**Status: COMPLETED**

### Authentication Middleware
- [x] Fix auth.middleware.ts exports
- [x] Update middleware type definitions
- [x] Add proper error handling types
- [x] Fix organization member type compatibility

### Platform Middleware
- [x] Update platform auth types
- [x] Fix audit log middleware types
- [x] Add proper request validation types

### Validation Middleware
- [x] Create validation middleware
- [x] Add request validation types
- [x] Add proper sanitization
- [x] Add error handling

## Phase 3: Service Implementation
**Priority: MEDIUM**
**Status: COMPLETED**

### Auth Service
- [x] Update WebAuthn method implementations
- [x] Fix Prisma include types
- [x] Add proper error handling
- [x] Update token verification methods

### Organization Service
- [x] Fix organization status handling
- [x] Update member management types
- [x] Fix subscription integration

### Platform Service
- [x] Fix duplicate implementations
- [x] Update audit log integration
- [x] Fix user search types
- [x] Update subscription handling
- [x] Remove mapping helper functions
- [x] Fix DTO type safety
- [x] Add proper pagination support
- [x] Improve error handling

### Subscription Service
- [x] Fix subscription type compatibility
- [x] Add proper validation
- [x] Update Stripe integration
- [x] Add transaction support

## Phase 4: Route Handlers
**Priority: MEDIUM**
**Status: IN PROGRESS**

### Auth Routes
- [x] Update WebAuthn route handlers
- [x] Fix request validation
- [x] Add proper error responses
- [ ] Update route handler return types
- [ ] Add request body validation

### Organization Routes
- [x] Fix member management routes
- [x] Update subscription routes
- [x] Add proper validation
- [ ] Add response type validation
- [ ] Update error handling

### Platform Routes
- [x] Fix analytics routes
- [x] Update security routes
- [x] Fix revenue routes
- [ ] Add proper request validation
- [ ] Update response types

## Phase 5: Testing and Documentation
**Priority: LOW**
**Status: NOT STARTED**

### Type Tests
- [ ] Add type tests for DTOs
- [ ] Add type tests for service methods
- [ ] Add type tests for middleware
- [ ] Add type tests for route handlers

### Documentation
- [ ] Update API documentation with types
- [ ] Add type usage examples
- [ ] Document error handling
- [ ] Add middleware documentation

## Progress Tracking

### Completed Fixes 
1. Fixed type conflicts in auth.ts and updated UserDTO structure
2. Updated platform-related types in platform.ts
3. Fixed subscription type compatibility
4. Updated middleware exports and type definitions
5. Improved platform service type safety and error handling
6. Added proper validation middleware
7. Updated WebAuthn integration types
8. Fixed member management and subscription integration
9. Improved audit log type definitions
10. Added proper pagination support in services
11. Fixed type export conflicts in `types/index.ts`
12. Fixed middleware exports and type definitions
13. Updated auth middleware types and error handling
14. Fixed subscription DTO type conflicts
15. Updated platform service type definitions
16. Fixed auth service type compatibility
17. Fixed organization member type definitions
18. Updated WebAuthn type definitions
19. Fixed token payload and auth response types

### Current Issues
1. Duplicate type declarations in auth.ts:
   - ChurchStatus, SubscriptionStatus, SubscriptionPlan enums
   - OrganizationMemberDTO and SubscriptionDTO imports

2. Missing error types:
   - BadRequestError
   - ForbiddenError
   - UnauthorizedError

3. Route handler type mismatches:
   - AuthenticatedRequest type compatibility
   - Missing validate middleware exports
   - Incorrect error handling types

4. Service implementation issues:
   - Duplicate function implementations in PlatformService
   - Missing Prisma namespace
   - Incorrect DTO mappings

5. Middleware issues:
   - Missing ExtendedResponse and AuditLogOptions types
   - Incorrect middleware exports
   - Type conflicts in platformAuth

### Next Steps
1. Create error types:
   ```
   src/errors/
   ├── bad-request.error.ts
   ├── forbidden.error.ts
   └── unauthorized.error.ts
   ```

2. Fix type exports:
   - Remove duplicate enum declarations
   - Fix import conflicts
   - Update DTO mappings

3. Update route handlers:
   - Fix request/response types
   - Add proper error handling
   - Update middleware usage

4. Fix service implementations:
   - Remove duplicate functions
   - Fix Prisma type imports
   - Update DTO mappings

5. Add type tests:
   - Request/response validation
   - DTO compatibility
   - Middleware type safety

## Dependencies
- @prisma/client
- express
- jsonwebtoken
- @simplewebauthn/server

## Notes
- All type definitions should follow TypeScript best practices
- Maintain strict type checking
- Avoid any unnecessary type assertions
- Keep type definitions DRY and maintainable
- Fix circular dependencies in type imports
