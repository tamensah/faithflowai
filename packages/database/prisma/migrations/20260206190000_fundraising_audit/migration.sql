-- CreateEnum
CREATE TYPE "FundraiserStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'WEBHOOK');

-- AlterTable
ALTER TABLE "Church" ADD COLUMN "countryCode" TEXT DEFAULT 'US';

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN "fundraiserPageId" TEXT;
ALTER TABLE "Donation" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DonationReceipt" ADD COLUMN "voidReason" TEXT;

-- CreateTable
CREATE TABLE "FundraiserPage" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,
    "campaignId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goalAmount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "message" TEXT,
    "status" "FundraiserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundraiserPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "churchId" TEXT,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundraiserPage_churchId_slug_key" ON "FundraiserPage"("churchId", "slug");

-- CreateIndex
CREATE INDEX "FundraiserPage_churchId_idx" ON "FundraiserPage"("churchId");

-- CreateIndex
CREATE INDEX "FundraiserPage_campaignId_idx" ON "FundraiserPage"("campaignId");

-- CreateIndex
CREATE INDEX "FundraiserPage_status_idx" ON "FundraiserPage"("status");

-- CreateIndex
CREATE INDEX "Donation_fundraiserPageId_idx" ON "Donation"("fundraiserPageId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_churchId_idx" ON "AuditLog"("churchId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "FundraiserPage" ADD CONSTRAINT "FundraiserPage_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiserPage" ADD CONSTRAINT "FundraiserPage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiserPage" ADD CONSTRAINT "FundraiserPage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_fundraiserPageId_fkey" FOREIGN KEY ("fundraiserPageId") REFERENCES "FundraiserPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
