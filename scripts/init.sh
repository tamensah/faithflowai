#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Initializing FaithFlow Development Environment...${NC}\n"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}" >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}pnpm is required but not installed.${NC}" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed.${NC}" >&2; exit 1; }

# Create project structure
echo -e "${GREEN}Creating project structure...${NC}"

mkdir -p apps/{web,admin,api}/src
mkdir -p packages/{ui,config,database,utils}/src

# Initialize package.json files
echo -e "${GREEN}Initializing package.json files...${NC}"

# Root package.json
cat > package.json << EOF
{
	"name": "faithflow",
	"private": true,
	"scripts": {
		"dev": "turbo run dev",
		"build": "turbo run build",
		"test": "turbo run test",
		"lint": "turbo run lint",
		"format": "prettier --write \"**/*.{ts,tsx,md}\""
	},
	"devDependencies": {
		"turbo": "latest",
		"prettier": "latest",
		"typescript": "latest"
	}
}
EOF

# Initialize web app
cd apps/web
pnpm init
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/react @types/node

# Initialize admin app
cd ../admin
pnpm init
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/react @types/node

# Initialize API
cd ../api
pnpm init
pnpm add @trpc/server zod prisma @prisma/client
pnpm add -D typescript @types/node

# Initialize shared packages
cd ../../packages/ui
pnpm init
pnpm add react@latest tailwindcss@latest shadcn-ui@latest
pnpm add -D typescript @types/react

# Setup database
cd ../database
pnpm init
pnpm add prisma@latest @prisma/client@latest

# Create initial Prisma schema
cat > prisma/schema.prisma << EOF
generator client {
	provider = "prisma-client-js"
}

datasource db {
	provider = "postgresql"
	url      = env("DATABASE_URL")
}

// Initial models will be added here
EOF

# Setup Docker environment
cd ../..
cat > docker-compose.yml << EOF
version: '3.8'
services:
	postgres:
		image: postgres:15
		environment:
			POSTGRES_USER: faithflow
			POSTGRES_PASSWORD: faithflow
			POSTGRES_DB: faithflow
		ports:
			- "5432:5432"
		volumes:
			- postgres_data:/var/lib/postgresql/data

	redis:
		image: redis:alpine
		ports:
			- "6379:6379"
		volumes:
			- redis_data:/data

volumes:
	postgres_data:
	redis_data:
EOF

# Create .env file
cat > .env << EOF
# Database
DATABASE_URL="postgresql://faithflow:faithflow@localhost:5432/faithflow"
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Storage
S3_BUCKET="faithflow-local"
S3_REGION="us-east-1"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"

# Payment (Test Keys)
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
PAYSTACK_SECRET_KEY="sk_test_..."

# Communication
RESEND_API_KEY="re_..."
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your-auth-token"
EOF

# Initialize Git repository
git init
cat > .gitignore << EOF
node_modules
.env
.env.*
!.env.example
.next
dist
.turbo
EOF

# Start Docker containers
echo -e "${GREEN}Starting Docker containers...${NC}"
docker-compose up -d

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pnpm install

echo -e "${BLUE}FaithFlow development environment initialized successfully!${NC}"
echo -e "${GREEN}Next steps:${NC}"
echo "1. Update .env with your credentials"
echo "2. Run 'pnpm dev' to start development servers"
echo "3. Visit http://localhost:3000 for the web app"
echo "4. Visit http://localhost:3001 for the admin dashboard"