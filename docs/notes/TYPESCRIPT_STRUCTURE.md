# TypeScript Project Structure Guide

This document outlines the correct order for creating and maintaining TypeScript files in our project, ensuring type safety and proper dependency management.

## 1. Schema First (`schema.prisma`)

Our Prisma schema defines the following main entities:

### Core Models
- `User`: Main user entity with platform roles
- `Organization`: Organization management
- `Subscription`: Subscription and billing
- `SecuritySettings`: User security preferences
- `AuditLog`: System-wide activity tracking

### Authentication Models
- `Passkey`: WebAuthn credentials
- `Session`: User sessions
- `ChallengeVerification`: Authentication challenges
- `OAuthProvider`: OAuth integration

### Enums
- `Role`: User roles (SUPER_ADMIN, PLATFORM_ADMIN, etc.)
- `AccessLevel`: Access scopes (PLATFORM, CHURCH, MEMBER)
- `ChurchStatus`: Church status tracking
- `OnboardingStep`: Onboarding process stages

## 2. Types/Interfaces (`types/index.ts`)

After Prisma generates types, create the following structure:

```typescript
// Base types from Prisma
import { User, Organization, Subscription } from '@prisma/client';

// DTOs
export interface UserDTO extends Omit<User, 'password'> {
  organizations?: Organization[];
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roles?: Role[];
}

// Service interfaces
export interface IAuthService {
  createUser(input: CreateUserInput): Promise<UserDTO>;
  validateUser(email: string, password: string): Promise<UserDTO>;
}

// Request/Response types
export interface AuthResponse {
  user: UserDTO;
  token: string;
}

export interface ErrorResponse {
  message: string;
  code: string;
}
```

## 3. Services (`*.service.ts`)

Services should implement the interfaces defined in types:

```typescript
import { IAuthService, CreateUserInput, UserDTO } from '../types';

export class AuthService implements IAuthService {
  async createUser(input: CreateUserInput): Promise<UserDTO> {
    // Implementation
  }

  async validateUser(email: string, password: string): Promise<UserDTO> {
    // Implementation
  }
}
```

## 4. Middleware

Middleware should use types for request/response objects:

```typescript
import { Request, Response, NextFunction } from 'express';
import { UserDTO, ErrorResponse } from '../types';

interface AuthenticatedRequest extends Request {
  user?: UserDTO;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Implementation
  } catch (error) {
    const response: ErrorResponse = {
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    };
    res.status(401).json(response);
  }
};
```

## Best Practices

1. **Type Safety**
   - Use strict mode in `tsconfig.json`
   - Avoid `any` type
   - Use proper type narrowing

2. **File Organization**
   - Keep related types in the same file
   - Use barrel exports (`index.ts`)
   - Maintain clear separation of concerns

3. **Error Handling**
   - Define custom error types
   - Use type predicates for error checking
   - Maintain consistent error responses

4. **Documentation**
   - Use JSDoc comments for public APIs
   - Document complex type relationships
   - Keep this guide updated

## Critical Development Guidelines

1. **Always Follow This Document**
   - This document is the source of truth for TypeScript structure
   - Always refer to this document before making changes
   - Always keep this document up-to-date
   - always use stripe.com as design guide
   - Never skip steps or take shortcuts
   - Reference this document before making any changes

2. **Complete One Task Fully**
   - Focus on one component/feature at a time
   - Ensure all types are properly defined before implementation
   - Complete error handling before moving to the next task

3. **Build and Verify**
   - Run `npm run build` after EVERY significant change
   - Fix ALL TypeScript errors before moving forward
   - Never leave type errors for later

4. **Testing Requirements**
   - Write types first, then implementation
   - Add tests for new functionality
   - Ensure all tests pass before committing

5. **Documentation Updates**
   - Update this document when adding new patterns
   - Keep type definitions in sync with schema changes
   - Document breaking changes

## Error Prevention Checklist

Before completing any task:
- [ ] All required types are defined in `types/`
- [ ] Services implement proper interfaces
- [ ] Middleware uses correct request/response types
- [ ] Build succeeds with no TypeScript errors
- [ ] Tests are written and passing
- [ ] Documentation is updated

## Development Flow

1. Make schema changes in `schema.prisma`
2. Run `prisma generate`
3. Update types in `types/`
4. Implement services
5. Create/update middleware
6. Update tests
