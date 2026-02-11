-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'SECURITY_ADMIN', 'COMPLIANCE_OFFICER', 'BILLING_ADMIN', 'ANALYTICS_ADMIN');

-- CreateEnum
CREATE TYPE "PlatformUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "PlatformUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformUserRole" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_clerkUserId_key" ON "PlatformUser"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE INDEX "PlatformUserRole_role_idx" ON "PlatformUserRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUserRole_platformUserId_role_key" ON "PlatformUserRole"("platformUserId", "role");

-- AddForeignKey
ALTER TABLE "PlatformUserRole" ADD CONSTRAINT "PlatformUserRole_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
