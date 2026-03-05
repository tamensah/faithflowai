# FaithLow Platform

## Recent Updates

### Type System Overhaul (2024-12-22)

We've completed a major refactor of the type system to improve type safety and reduce errors:

1. **Consolidated Types**
   - All types are now in a single `types/index.ts` file
   - Removed duplicate type definitions
   - Improved type hierarchy and relationships

2. **Service Improvements**
   - Updated all services to use consistent type definitions
   - Added proper error handling
   - Improved security settings support

3. **Auth Middleware**
   - Better type safety in middleware
   - Improved role-based access control
   - Enhanced organization membership verification

4. **Code Organization**
   - Better separation of concerns
   - Consistent method signatures
   - Simplified service implementations

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp packages/api/.env.example packages/api/.env
```

3. Start the development server:
```bash
pnpm dev
```

## Development Guidelines

1. **Type Safety**
   - All new code must use TypeScript
   - Use types from `types/index.ts`
   - Add proper error handling

2. **Code Style**
   - Follow existing patterns
   - Use async/await
   - Add proper documentation

3. **Testing**
   - Write unit tests for new features
   - Update tests when modifying existing code
   - Ensure all tests pass before committing

## Architecture

The platform consists of several key components:

1. **API Services**
   - AuthService: Handles authentication and authorization
   - OrganizationService: Manages organizations and members
   - PlatformService: Provides platform-wide functionality

2. **Middleware**
   - AuthMiddleware: Handles request authentication
   - RoleMiddleware: Manages role-based access
   - OrganizationMiddleware: Verifies organization access

3. **Types**
   - All types are in `types/index.ts`
   - Follow the type hierarchy
   - Use proper interfaces for services

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Run tests
4. Submit a pull request

## License

Copyright © 2024 FaithLow. All rights reserved.
