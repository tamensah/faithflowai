-- CreateEnum
CREATE TYPE "TenantDomainStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "TenantSslStatus" AS ENUM ('PENDING', 'PROVISIONED', 'EXPIRING_SOON', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "HealthCheckType" AS ENUM ('API', 'DATABASE', 'WEBHOOK', 'EMAIL', 'SMS', 'STORAGE', 'WORKER');

-- CreateEnum
CREATE TYPE "HealthCheckStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'OUTAGE');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketSource" AS ENUM ('IN_APP', 'EMAIL', 'CHAT', 'PHONE');

-- CreateEnum
CREATE TYPE "SupportMessageAuthorType" AS ENUM ('PLATFORM_USER', 'TENANT_USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LiveStreamProvider" AS ENUM ('YOUTUBE', 'FACEBOOK', 'VIMEO', 'CUSTOM_RTMP');

-- CreateEnum
CREATE TYPE "LiveStreamStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LiveModerationLevel" AS ENUM ('OPEN', 'FILTERED', 'STRICT');

-- CreateTable
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "TenantDomainStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationToken" TEXT NOT NULL,
    "dnsTarget" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sslStatus" "TenantSslStatus" NOT NULL DEFAULT 'PENDING',
    "sslExpiresAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantHealthCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "HealthCheckType" NOT NULL,
    "status" "HealthCheckStatus" NOT NULL DEFAULT 'HEALTHY',
    "latencyMs" INTEGER,
    "details" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSecurityPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requireMfaForStaff" BOOLEAN NOT NULL DEFAULT true,
    "enforceSso" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 480,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 3650,
    "ipAllowlist" JSONB,
    "breachContactEmail" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "churchId" TEXT,
    "requesterEmail" TEXT,
    "requesterName" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "source" "SupportTicketSource" NOT NULL DEFAULT 'IN_APP',
    "assignedToPlatformUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" "SupportMessageAuthorType" NOT NULL,
    "authorPlatformUserId" TEXT,
    "authorTenantUserId" TEXT,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStreamChannel" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "provider" "LiveStreamProvider" NOT NULL,
    "externalChannelId" TEXT,
    "ingestUrl" TEXT,
    "playbackUrl" TEXT,
    "streamKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStreamChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStreamSession" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "eventId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LiveStreamStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationLevel" "LiveModerationLevel" NOT NULL DEFAULT 'FILTERED',
    "scheduledStartAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "isRecording" BOOLEAN NOT NULL DEFAULT true,
    "recordingUrl" TEXT,
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantDomain_status_idx" ON "TenantDomain"("status");

-- CreateIndex
CREATE INDEX "TenantDomain_sslStatus_idx" ON "TenantDomain"("sslStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_tenantId_domain_key" ON "TenantDomain"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "TenantHealthCheck_tenantId_checkedAt_idx" ON "TenantHealthCheck"("tenantId", "checkedAt");

-- CreateIndex
CREATE INDEX "TenantHealthCheck_type_status_idx" ON "TenantHealthCheck"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSecurityPolicy_tenantId_key" ON "TenantSecurityPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "SupportTicket_tenantId_status_priority_idx" ON "SupportTicket"("tenantId", "status", "priority");

-- CreateIndex
CREATE INDEX "SupportTicket_churchId_idx" ON "SupportTicket"("churchId");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToPlatformUserId_idx" ON "SupportTicket"("assignedToPlatformUserId");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_authorPlatformUserId_idx" ON "SupportTicketMessage"("authorPlatformUserId");

-- CreateIndex
CREATE INDEX "LiveStreamChannel_campusId_idx" ON "LiveStreamChannel"("campusId");

-- CreateIndex
CREATE INDEX "LiveStreamChannel_provider_isActive_idx" ON "LiveStreamChannel"("provider", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStreamChannel_churchId_name_key" ON "LiveStreamChannel"("churchId", "name");

-- CreateIndex
CREATE INDEX "LiveStreamSession_churchId_status_idx" ON "LiveStreamSession"("churchId", "status");

-- CreateIndex
CREATE INDEX "LiveStreamSession_channelId_scheduledStartAt_idx" ON "LiveStreamSession"("channelId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "LiveStreamSession_eventId_idx" ON "LiveStreamSession"("eventId");

-- AddForeignKey
ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantHealthCheck" ADD CONSTRAINT "TenantHealthCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSecurityPolicy" ADD CONSTRAINT "TenantSecurityPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToPlatformUserId_fkey" FOREIGN KEY ("assignedToPlatformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorPlatformUserId_fkey" FOREIGN KEY ("authorPlatformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamChannel" ADD CONSTRAINT "LiveStreamChannel_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamChannel" ADD CONSTRAINT "LiveStreamChannel_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamSession" ADD CONSTRAINT "LiveStreamSession_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamSession" ADD CONSTRAINT "LiveStreamSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "LiveStreamChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStreamSession" ADD CONSTRAINT "LiveStreamSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
