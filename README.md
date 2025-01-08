# FaithFlow Platform

FaithFlow is a comprehensive church management SaaS platform built with modern technologies to help churches manage their operations efficiently.

## Features

- 🏢 Multi-tenant architecture supporting churches with multiple branches
- 👥 Complete member management system
- 📅 Advanced event planning and management
- 💰 Multi-currency donation and financial management
- 📊 Comprehensive reporting and analytics
- 🌐 Custom website builder for each church
- 📱 Mobile-first responsive design
- 🔒 Enterprise-grade security

## Tech Stack

- **Frontend**: Next.js 15.0.3, React 18, TypeScript
- **Backend**: Node.js, tRPC, Prisma
- **Database**: PostgreSQL, Redis
- **Infrastructure**: Vercel, AWS, Cloudflare
- **Monitoring**: DataDog, Sentry, LogRocket

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis
- pnpm (preferred) or yarn
- Docker

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/faithflow/faithflow.git
cd faithflow
```

2. Run the initialization script:
```bash
./scripts/init.sh
```

3. Update environment variables in `.env`

4. Start development servers:
```bash
pnpm dev
```

### Access Points

- Web Application: http://localhost:3000
- Admin Dashboard: http://localhost:3001
- API Documentation: http://localhost:4000/docs

## Project Structure

```
faithflow/
├── apps/
│   ├── web/           # Next.js frontend
│   ├── admin/         # Admin dashboard
│   └── api/           # tRPC API
├── packages/
│   ├── ui/            # Shared UI components
│   ├── config/        # Shared configuration
│   ├── database/      # Database schemas
│   └── utils/         # Shared utilities
├── docs/              # Documentation
└── scripts/           # Development scripts
```

## Documentation

- [Technical Specification](docs/TECHNICAL_SPECIFICATION.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Development Setup](docs/DEVELOPMENT_SETUP.md)
- [UI Components](docs/UI_COMPONENTS.md)

## Development Workflow

1. Create feature branch:
```bash
git checkout -b feature/feature-name
```

2. Make changes and ensure tests pass:
```bash
pnpm test
```

3. Submit pull request

## Available Scripts

- `pnpm dev` - Start development servers
- `pnpm build` - Build all packages
- `pnpm test` - Run tests
- `pnpm lint` - Lint code
- `pnpm format` - Format code

## Subscription Plans

### Starter Plan
- Up to 500 members
- Basic features
- Single currency
- 5GB storage
- Email support

### Standard Plan
- Up to 2,000 members
- Multi-currency
- Advanced features
- 20GB storage
- Priority support

### Premium Plan
- Unlimited members
- All payment gateways
- Custom AI integration
- 100GB storage
- 24/7 support

## Security

- End-to-end encryption
- GDPR compliance
- Regular security audits
- Multi-factor authentication
- Role-based access control

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.