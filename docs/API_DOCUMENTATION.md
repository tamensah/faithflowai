# FaithFlow API Documentation

## API Overview

The FaithFlow API is built using tRPC with TypeScript for full end-to-end type safety. All endpoints are accessible through a single API gateway with proper authentication and rate limiting.

## Authentication

### Endpoints

#### 1. Authentication
```typescript
// POST /api/auth/login
interface LoginRequest {
	email: string;
	password: string;
	mfaToken?: string;
}

// POST /api/auth/register
interface RegisterRequest {
	churchName: string;
	email: string;
	password: string;
	plan: 'starter' | 'standard' | 'premium';
}

// POST /api/auth/refresh
interface RefreshRequest {
	refreshToken: string;
}
```

#### 2. Church Management
```typescript
// GET /api/church
interface ChurchResponse {
	id: string;
	name: string;
	subscription: SubscriptionDetails;
	features: string[];
}

// PUT /api/church/settings
interface UpdateChurchRequest {
	name?: string;
	timezone?: string;
	branding?: BrandingConfig;
	features?: string[];
}
```

#### 3. Member Management
```typescript
// GET /api/members
interface MemberListRequest {
	page: number;
	limit: number;
	filters?: {
		status?: 'active' | 'inactive';
		ministry?: string;
		group?: string;
	};
}

// POST /api/members
interface CreateMemberRequest {
	firstName: string;
	lastName: string;
	email: string;
	phone?: string;
	address?: Address;
	ministries?: string[];
	groups?: string[];
}
```

#### 4. Event Management
```typescript
// GET /api/events
interface EventListRequest {
	startDate: Date;
	endDate: Date;
	type?: 'service' | 'meeting' | 'class';
	status?: 'upcoming' | 'past' | 'cancelled';
}

// POST /api/events
interface CreateEventRequest {
	title: string;
	description: string;
	startDate: Date;
	endDate: Date;
	type: 'service' | 'meeting' | 'class';
	location: LocationDetails;
	registration?: RegistrationConfig;
}
```

#### 5. Financial Management
```typescript
// GET /api/giving
interface GivingListRequest {
	startDate: Date;
	endDate: Date;
	type?: 'one_time' | 'recurring';
	status?: 'completed' | 'pending' | 'failed';
}

// POST /api/giving
interface CreateGivingRequest {
	amount: number;
	currency: string;
	type: 'one_time' | 'recurring';
	method: 'card' | 'bank' | 'mobile_money';
	memberId: string;
	campaign?: string;
}
```

## Rate Limiting

- Starter Plan: 60 requests/minute
- Standard Plan: 120 requests/minute
- Premium Plan: 300 requests/minute

## Error Handling

All API errors follow this structure:
```typescript
interface APIError {
	code: string;
	message: string;
	details?: Record<string, any>;
	stack?: string; // Only in development
}
```

Common error codes:
- AUTH001: Authentication failed
- AUTH002: Token expired
- AUTH003: Invalid credentials
- VAL001: Validation error
- API001: Rate limit exceeded
- SRV001: Server error

## Webhooks

Available webhook events:
```typescript
type WebhookEvent =
	| 'member.created'
	| 'member.updated'
	| 'event.created'
	| 'event.updated'
	| 'giving.completed'
	| 'giving.failed';

interface WebhookPayload {
	event: WebhookEvent;
	churchId: string;
	data: Record<string, any>;
	timestamp: number;
}
```

## API Versioning

The API is versioned through the URL path:
- Current version: `/api/v1`
- Beta features: `/api/beta`
- Legacy support: `/api/v0` (deprecated)

## SDK Examples

### TypeScript/JavaScript
```typescript
import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '@faithflow/api';

const client = createTRPCClient<AppRouter>({
	url: 'https://api.faithflow.church/trpc',
});

// Example: Create a new member
await client.member.create.mutate({
	firstName: 'John',
	lastName: 'Doe',
	email: 'john@example.com'
});
```

### React Query Integration
```typescript
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@faithflow/api';

export const trpc = createTRPCReact<AppRouter>();

// In your component:
const { data, isLoading } = trpc.member.list.useQuery({
	page: 1,
	limit: 10
});
```