-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('STRIPE', 'PAYSTACK', 'STRIPE_PLATFORM', 'PAYSTACK_PLATFORM');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseBreachedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN     "lastSlaCheckAt" TIMESTAMP(3),
ADD COLUMN     "reopenedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolutionBreachedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "tenantId" TEXT,
    "churchId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_tenantId_receivedAt_idx" ON "WebhookEvent"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_churchId_receivedAt_idx" ON "WebhookEvent"("churchId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_firstResponseDueAt_idx" ON "SupportTicket"("status", "firstResponseDueAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_resolutionDueAt_idx" ON "SupportTicket"("status", "resolutionDueAt");

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
