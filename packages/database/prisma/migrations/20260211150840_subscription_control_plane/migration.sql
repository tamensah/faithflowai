-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('MANUAL', 'STRIPE', 'PAYSTACK');

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "TenantSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'MANUAL',
    "providerRef" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "seatCount" INTEGER,
    "metadata" JSONB,
    "createdByPlatformUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isDefault_idx" ON "SubscriptionPlan"("isDefault");

-- CreateIndex
CREATE INDEX "SubscriptionPlanFeature_key_idx" ON "SubscriptionPlanFeature"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanFeature_planId_key_key" ON "SubscriptionPlanFeature"("planId", "key");

-- CreateIndex
CREATE INDEX "TenantSubscription_tenantId_status_idx" ON "TenantSubscription"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");

-- CreateIndex
CREATE INDEX "TenantSubscription_provider_providerRef_idx" ON "TenantSubscription"("provider", "providerRef");

-- AddForeignKey
ALTER TABLE "SubscriptionPlanFeature" ADD CONSTRAINT "SubscriptionPlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_createdByPlatformUserId_fkey" FOREIGN KEY ("createdByPlatformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
