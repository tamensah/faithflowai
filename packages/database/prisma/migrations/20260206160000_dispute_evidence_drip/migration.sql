-- CreateEnum
CREATE TYPE "CommunicationScheduleStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DripCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DripEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DisputeEvidenceType" AS ENUM (
  'UNCATEGORIZED',
  'RECEIPT',
  'CUSTOMER_COMMUNICATION',
  'PRODUCT_DESCRIPTION',
  'REFUND_POLICY',
  'CUSTOMER_EMAIL',
  'CUSTOMER_NAME',
  'SHIPPING_DOCUMENTATION',
  'SHIPPING_TRACKING',
  'SHIPPING_DATE',
  'SERVICE_DOCUMENTATION',
  'SERVICE_DATE'
);

-- CreateEnum
CREATE TYPE "DisputeEvidenceStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FAILED');

-- CreateTable
CREATE TABLE "DisputeEvidence" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "type" "DisputeEvidenceType" NOT NULL,
    "status" "DisputeEvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "text" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileMime" TEXT,
    "fileSize" INTEGER,
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationSchedule" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "templateId" TEXT,
    "dripEnrollmentId" TEXT,
    "dripStepId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "provider" "CommunicationProvider" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" "CommunicationScheduleStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDripCampaign" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "DripCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationDripCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDripStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationDripStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDripEnrollment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "memberId" TEXT,
    "donorEmail" TEXT,
    "donorPhone" TEXT,
    "status" "DripEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationDripEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisputeEvidence_disputeId_idx" ON "DisputeEvidence"("disputeId");

-- CreateIndex
CREATE INDEX "DisputeEvidence_status_idx" ON "DisputeEvidence"("status");

-- CreateIndex
CREATE INDEX "DisputeEvidence_type_idx" ON "DisputeEvidence"("type");

-- CreateIndex
CREATE INDEX "CommunicationSchedule_churchId_idx" ON "CommunicationSchedule"("churchId");

-- CreateIndex
CREATE INDEX "CommunicationSchedule_templateId_idx" ON "CommunicationSchedule"("templateId");

-- CreateIndex
CREATE INDEX "CommunicationSchedule_dripEnrollmentId_idx" ON "CommunicationSchedule"("dripEnrollmentId");

-- CreateIndex
CREATE INDEX "CommunicationSchedule_dripStepId_idx" ON "CommunicationSchedule"("dripStepId");

-- CreateIndex
CREATE INDEX "CommunicationSchedule_status_idx" ON "CommunicationSchedule"("status");

-- CreateIndex
CREATE INDEX "CommunicationSchedule_sendAt_idx" ON "CommunicationSchedule"("sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationDripCampaign_churchId_name_key" ON "CommunicationDripCampaign"("churchId", "name");

-- CreateIndex
CREATE INDEX "CommunicationDripCampaign_churchId_idx" ON "CommunicationDripCampaign"("churchId");

-- CreateIndex
CREATE INDEX "CommunicationDripCampaign_status_idx" ON "CommunicationDripCampaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationDripStep_campaignId_stepOrder_key" ON "CommunicationDripStep"("campaignId", "stepOrder");

-- CreateIndex
CREATE INDEX "CommunicationDripStep_campaignId_idx" ON "CommunicationDripStep"("campaignId");

-- CreateIndex
CREATE INDEX "CommunicationDripEnrollment_campaignId_idx" ON "CommunicationDripEnrollment"("campaignId");

-- CreateIndex
CREATE INDEX "CommunicationDripEnrollment_churchId_idx" ON "CommunicationDripEnrollment"("churchId");

-- CreateIndex
CREATE INDEX "CommunicationDripEnrollment_status_idx" ON "CommunicationDripEnrollment"("status");

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationSchedule" ADD CONSTRAINT "CommunicationSchedule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationSchedule" ADD CONSTRAINT "CommunicationSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationSchedule" ADD CONSTRAINT "CommunicationSchedule_dripEnrollmentId_fkey" FOREIGN KEY ("dripEnrollmentId") REFERENCES "CommunicationDripEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationSchedule" ADD CONSTRAINT "CommunicationSchedule_dripStepId_fkey" FOREIGN KEY ("dripStepId") REFERENCES "CommunicationDripStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripCampaign" ADD CONSTRAINT "CommunicationDripCampaign_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripStep" ADD CONSTRAINT "CommunicationDripStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationDripCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripStep" ADD CONSTRAINT "CommunicationDripStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripEnrollment" ADD CONSTRAINT "CommunicationDripEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationDripCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripEnrollment" ADD CONSTRAINT "CommunicationDripEnrollment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripEnrollment" ADD CONSTRAINT "CommunicationDripEnrollment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
