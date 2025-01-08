#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Running FaithFlow Implementation Validation...${NC}\n"

# Function to check if a command exists
command_exists() {
	command -v "$1" >/dev/null 2>&1
}

# Function to validate TypeScript files
validate_typescript() {
	echo -e "${BLUE}Validating TypeScript files...${NC}"
	if ! command_exists "tsc"; then
		echo -e "${RED}TypeScript compiler not found${NC}"
		exit 1
	fi
	tsc --noEmit
}

# Function to validate Prisma schema
validate_prisma() {
	echo -e "${BLUE}Validating Prisma schema...${NC}"
	cd packages/database
	pnpm prisma validate
	cd ../..
}

# Function to check project structure
check_structure() {
	echo -e "${BLUE}Checking project structure...${NC}"
	
	required_dirs=(
		"apps/web/src"
		"apps/admin/src"
		"apps/api/src"
		"packages/ui/src"
		"packages/config/src"
		"packages/database/src"
		"packages/utils/src"
	)
	
	required_files=(
		"package.json"
		"tsconfig.json"
		".eslintrc.json"
		"packages/database/prisma/schema.prisma"
	)
	
	for dir in "${required_dirs[@]}"; do
		if [ ! -d "$dir" ]; then
			echo -e "${RED}Missing directory: $dir${NC}"
			exit 1
		fi
	done
	
	for file in "${required_files[@]}"; do
		if [ ! -f "$file" ]; then
			echo -e "${RED}Missing file: $file${NC}"
			exit 1
		fi
	done
}

# Function to validate dependencies
check_dependencies() {
	echo -e "${BLUE}Checking dependencies...${NC}"
	
	required_deps=(
		"next"
		"react"
		"react-dom"
		"@trpc/server"
		"@trpc/client"
		"prisma"
		"@prisma/client"
		"zod"
	)
	
	for dep in "${required_deps[@]}"; do
		if ! grep -q "\"$dep\"" package.json; then
			echo -e "${RED}Missing dependency: $dep${NC}"
			exit 1
		fi
	done
}

# Function to validate environment variables
check_env() {
	echo -e "${BLUE}Checking environment variables...${NC}"
	
	required_vars=(
		"DATABASE_URL"
		"REDIS_URL"
		"NEXTAUTH_URL"
		"NEXTAUTH_SECRET"
	)
	
	if [ ! -f ".env" ]; then
		echo -e "${RED}.env file not found${NC}"
		exit 1
	fi
	
	for var in "${required_vars[@]}"; do
		if ! grep -q "^$var=" .env; then
			echo -e "${RED}Missing environment variable: $var${NC}"
			exit 1
		fi
	done
}

# Function to run tests
run_tests() {
	echo -e "${BLUE}Running tests...${NC}"
	pnpm test
}

# Function to check code formatting
check_formatting() {
	echo -e "${BLUE}Checking code formatting...${NC}"
	pnpm format --check
}

# Function to check database connection
check_database() {
	echo -e "${BLUE}Checking database connection...${NC}"
	cd packages/database
	pnpm prisma db push --skip-generate
	cd ../..
}

# Main validation flow
main() {
	echo "Starting validation..."
	
	check_structure
	check_dependencies
	check_env
	validate_typescript
	validate_prisma
	check_formatting
	check_database
	run_tests
	
	echo -e "${GREEN}All validations passed successfully!${NC}"
}

# Run main function
main