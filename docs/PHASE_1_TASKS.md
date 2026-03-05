# FaithFlow Phase 1 Implementation Tasks

## Week 1: Initial Setup & Configuration

### Day 1-2: Project Structure 
1. Create project directories 
```bash
mkdir -p apps/{web,admin,api}/src packages/{ui,config,database,utils}/src
```

2. Initialize base configuration files 
```bash
# Root tsconfig.json
{
	"compilerOptions": {
		"strict": true,
		"target": "ES2020",
		"lib": ["DOM", "DOM.Iterable", "ESNext"],
		"module": "ESNext",
		"skipLibCheck": true,
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"resolveJsonModule": true,
		"isolatedModules": true,
		"noEmit": true,
		"jsx": "preserve",
		"incremental": true,
		"paths": {
			"@faithflow/*": ["./packages/*/src"]
		}
	},
	"include": ["**/*.ts", "**/*.tsx"],
	"exclude": ["node_modules"]
}
```

3. Setup ESLint & Prettier 
```json
// .eslintrc.json
{
	"extends": [
		"next/core-web-vitals",
		"plugin:@typescript-eslint/recommended",
		"prettier"
	],
	"plugins": ["@typescript-eslint"],
	"rules": {
		"@typescript-eslint/no-unused-vars": "error",
		"@typescript-eslint/no-explicit-any": "error",
		"react-hooks/rules-of-hooks": "error"
	}
}
```

### Day 3-4: Database Setup 

1. Initialize Prisma 
```bash
cd packages/database
pnpm add prisma @prisma/client
pnpm prisma init
```

2. Create initial schema 
```prisma
// prisma/schema.prisma
generator client {
	provider = "prisma-client-js"
}

datasource db {
	provider = "postgresql"
	url      = env("DATABASE_URL")
}

model Church {
	id          String   @id @default(cuid())
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	name        String
	slug        String   @unique
	domain      String?  @unique
	timezone    String   @default("UTC")
	
	// Relations
	members     Member[]
	events      Event[]
	
	@@index([slug])
	@@index([domain])
}

model Member {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	firstName   String
	lastName    String
	email       String?
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	events      Event[]
	
	@@index([churchId])
	@@index([email])
}

model Event {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	title       String
	description String?
	startDate   DateTime
	endDate     DateTime
	location    String?
	capacity    Int?
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	attendees   Member[]
	
	@@index([churchId])
	@@index([startDate])
}

model SmallGroup {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	name        String
	description String?
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	members     Member[]
	
	@@index([churchId])
}

model User {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	firstName   String
	lastName    String
	email       String?
	role        String   @default("MEMBER")
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	events      Event[]
	smallGroups SmallGroup[]
	
	@@index([churchId])
	@@index([email])
}

model Analytics {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	type        String
	data        Json
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	
	@@index([churchId])
	@@index([type])
}

model Payment {
	id          String   @id @default(cuid())
	churchId    String
	createdAt   DateTime @default(now())
	updatedAt   DateTime @updatedAt
	type        String
	data        Json
	
	// Relations
	church      Church   @relation(fields: [churchId], references: [id])
	
	@@index([churchId])
	@@index([type])
}
```

### Day 5: API Foundation 

1. Setup tRPC 
```typescript
// apps/api/src/trpc.ts
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
	transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

2. Create base router 
```typescript
// apps/api/src/router/index.ts
import { router } from '../trpc';
import { churchRouter } from './church';
import { memberRouter } from './member';
import { eventRouter } from './event';
import { smallGroupRouter } from './smallGroup';
import { userRouter } from './user';
import { analyticsRouter } from './analytics';
import { paymentRouter } from './payment';

export const appRouter = router({
	church: churchRouter,
	member: memberRouter,
	event: eventRouter,
	smallGroup: smallGroupRouter,
	user: userRouter,
	analytics: analyticsRouter,
	payment: paymentRouter,
});

export type AppRouter = typeof appRouter;
```

### Day 6-7: Frontend Foundation 

1. Setup Next.js apps 
```bash
cd apps/web
pnpm create next-app . --typescript --tailwind --eslint

cd ../admin
pnpm create next-app . --typescript --tailwind --eslint
```

2. Configure Tailwind 
```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
	content: [
		'./src/**/*.{js,ts,jsx,tsx,mdx}',
		'../../packages/ui/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			colors: {
				primary: {...},
				secondary: {...},
			},
		},
	},
	plugins: [],
};

export default config;
```

## Week 2: Core Components & Testing 

### Day 8-9: UI Components 

1. Setup UI package 
```typescript
// packages/ui/src/index.ts
export * from './components/button';
export * from './components/input';
export * from './components/card';
```

2. Create base components 
```typescript
// packages/ui/src/components/button.tsx
import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90',
				destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
				outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
			},
			size: {
				default: 'h-10 py-2 px-4',
				sm: 'h-9 px-3 rounded-md',
				lg: 'h-11 px-8 rounded-md',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);
```

### Day 10-11: Testing Setup 

1. Configure Jest 
```typescript
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
	dir: './',
});

const config: Config = {
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	testEnvironment: 'jest-environment-jsdom',
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
	},
};

export default createJestConfig(config);
```

2. Create test utilities 
```typescript
// packages/utils/src/test/test-utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

export function renderWithClient(ui: React.ReactElement) {
	const testQueryClient = createTestQueryClient();
	return render(
		<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
	);
}
```

### Day 12-14: Error Handling & Logging 

1. Setup error handling 
```typescript
// packages/utils/src/errors/app-error.ts
export class AppError extends Error {
	constructor(
		public code: string,
		message: string,
		public status: number = 400
	) {
		super(message);
		this.name = 'AppError';
	}
}

export const errorCodes = {
	INVALID_INPUT: 'INVALID_INPUT',
	NOT_FOUND: 'NOT_FOUND',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

2. Configure logging 
```typescript
// packages/utils/src/logging/logger.ts
import pino from 'pino';

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	transport: {
		target: 'pino-pretty',
		options: {
			colorize: true,
		},
	},
});
```

## End of Phase 1 Checklist 

- [x] Project structure created 
- [x] Base configuration files set up 
- [x] Database schema initialized 
- [x] API foundation laid 
- [x] UI components started 
- [x] Testing infrastructure ready 
- [x] Error handling implemented 
- [x] Logging system configured 

## Next Steps for Phase 2 

1. Authentication system 
2. Protected routes 
3. API endpoints for core features 
4. Database migrations 
5. Component library expansion 