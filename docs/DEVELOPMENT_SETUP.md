# FaithFlow Development Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis
- pnpm (preferred) or yarn
- Docker (optional, for containerized development)

## Repository Setup

1. Clone the repository:
```bash
git clone https://github.com/faithflow/faithflow.git
cd faithflow
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Required environment variables:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/faithflow"
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
FAITHFLOW_REQUIRE_VERIFIED_EMAIL="false"
FAITHFLOW_REQUIRE_ADMIN_MFA="false"
FAITHFLOW_MAX_ADMIN_SESSION_AGE_MINUTES=""
FAITHFLOW_ALLOWED_ADMIN_EMAIL_DOMAINS=""
FAITHFLOW_PRIVILEGED_ROLES="PLATFORM_SUPER_ADMIN,PLATFORM_SUPPORT,CHURCH_ADMIN,ORG_ADMIN,FINANCE_ADMIN,HR_ADMIN,COMMS_ADMIN,STAFF"

# Storage
S3_BUCKET="faithflow-local"
S3_REGION="us-east-1"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"

# Payment (Test Keys)
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_SUPPORTED_CURRENCIES="NGN,GHS,ZAR,KES,USD"

# Communication
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="FaithFlow <onboarding@yourdomain.com>"
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+15551234567"
TWILIO_WHATSAPP_NUMBER="whatsapp:+15551234567"
STRIPE_WEBHOOK_SECRET="whsec_..."
RESEND_WEBHOOK_SECRET="whsec_..."
FAITHFLOW_ALLOW_UNSIGNED_WEBHOOKS="false"

# Outbox Processing
FAITHFLOW_PROVIDER_STRICT_MODE="false"
FAITHFLOW_OUTBOX_MAX_RETRIES="5"
FAITHFLOW_OUTBOX_RETRY_DELAY_SECONDS="30"
FAITHFLOW_OUTBOX_RETRY_BACKOFF_MULTIPLIER="2"
```

Webhook endpoints to register on provider dashboards (admin host):
```text
POST /api/webhooks/stripe
POST /api/webhooks/paystack
POST /api/webhooks/resend
POST /api/webhooks/twilio
```

Full provider setup checklist and env ownership matrix:
`docs/THIRDPARTY_CONFIG.md`

## Development Workflow

### 1. Start Development Environment

```bash
# Start all services
pnpm dev

# Start specific apps
pnpm dev:web     # Web application
pnpm dev:admin   # Admin dashboard
pnpm dev:api     # API server
```

### 2. Database Management

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Reset database (development only)
pnpm prisma reset

# Open Prisma Studio
pnpm prisma studio
```

### 3. Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:payment-comms-e2e
pnpm test:provider-webhooks-e2e

# Process outbox domains once (for cron/job workers)
pnpm outbox:process

# Run tests in watch mode
pnpm test:watch
```

### 4. Code Quality

```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck
```

## Project Structure

```
faithflow/
├── apps/
│   ├── web/               # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── admin/            # Admin dashboard
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── api/             # tRPC API
│       ├── src/
│       │   ├── routers/
│       │   ├── services/
│       │   └── utils/
│       └── package.json
│
├── packages/
│   ├── ui/              # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   └── styles/
│   │   └── package.json
│   │
│   ├── config/         # Shared configuration
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── package.json
│   │
│   ├── database/      # Database schemas & migrations
│   │   ├── prisma/
│   │   ├── migrations/
│   │   └── package.json
│   │
│   └── utils/         # Shared utilities
│       ├── src/
│       └── package.json
│
├── docs/             # Documentation
├── scripts/          # Development scripts
├── package.json
└── turbo.json
```

## Docker Development

1. Build containers:
```bash
docker-compose build
```

2. Start services:
```bash
docker-compose up -d
```

3. View logs:
```bash
docker-compose logs -f
```

## Common Development Tasks

### Adding a New Feature

1. Create feature branch:
```bash
git checkout -b feature/feature-name
```

2. Implement changes following the style guide

3. Add tests

4. Update documentation

5. Create pull request

### Database Changes

1. Create migration:
```bash
pnpm prisma migrate dev --name migration-name
```

2. Update schema documentation

3. Test migrations (up/down)

4. Update affected API endpoints

### Adding Dependencies

```bash
# Add to specific workspace
pnpm add package-name --filter @faithflow/web

# Add to all workspaces
pnpm add package-name -w
```

## Troubleshooting

### Common Issues

1. Database Connection
```bash
# Check database status
pg_isready -h localhost -p 5432

# Reset database
pnpm prisma migrate reset
```

2. Redis Connection
```bash
# Check Redis status
redis-cli ping

# Flush Redis
redis-cli flushall
```

3. Build Issues
```bash
# Clear build cache
pnpm clean

# Rebuild
pnpm build
```

## Performance Monitoring

### Local Development

1. Enable performance monitoring:
```bash
NEXT_RUNTIME_METRICS=1 pnpm dev
```

2. Access metrics:
- Web Vitals: http://localhost:3000/metrics
- API Metrics: http://localhost:4000/metrics

### Production Monitoring

- DataDog metrics
- Sentry error tracking
- LogRocket session replay

## Security Guidelines

1. Secrets Management
- Use .env for local development
- Use GitHub Secrets for CI/CD
- Use AWS Secrets Manager for production

2. Code Security
- Run security linting
- Regular dependency updates
- Code scanning enabled

3. API Security
- Rate limiting enabled
- CORS configured
- Authentication required

## Deployment

### Staging Deployment

```bash
pnpm deploy:staging
```

### Production Deployment

```bash
pnpm deploy:production
```

### Post-Deployment Checks

1. Run health checks
2. Verify database migrations
3. Check monitoring dashboards
4. Validate key functionality
