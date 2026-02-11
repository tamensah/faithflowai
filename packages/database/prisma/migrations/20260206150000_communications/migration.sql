-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "CommunicationProvider" AS ENUM ('RESEND', 'TWILIO');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "templateId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "provider" "CommunicationProvider" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_churchId_name_channel_key" ON "CommunicationTemplate"("churchId", "name", "channel");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_churchId_idx" ON "CommunicationTemplate"("churchId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_channel_idx" ON "CommunicationTemplate"("channel");

-- CreateIndex
CREATE INDEX "CommunicationMessage_churchId_idx" ON "CommunicationMessage"("churchId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_templateId_idx" ON "CommunicationMessage"("templateId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_channel_idx" ON "CommunicationMessage"("channel");

-- CreateIndex
CREATE INDEX "CommunicationMessage_provider_idx" ON "CommunicationMessage"("provider");

-- CreateIndex
CREATE INDEX "CommunicationMessage_status_idx" ON "CommunicationMessage"("status");

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
