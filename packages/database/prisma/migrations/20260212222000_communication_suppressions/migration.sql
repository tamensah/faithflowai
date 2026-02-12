-- CreateEnum
CREATE TYPE "CommunicationSuppressionReason" AS ENUM ('USER_UNSUBSCRIBE', 'ADMIN_SUPPRESS', 'BOUNCE', 'COMPLAINT');

-- CreateTable
CREATE TABLE "CommunicationSuppression" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "address" TEXT NOT NULL,
    "reason" "CommunicationSuppressionReason" NOT NULL DEFAULT 'USER_UNSUBSCRIBE',
    "createdByClerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationSuppression_tenantId_channel_idx" ON "CommunicationSuppression"("tenantId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationSuppression_tenantId_channel_address_key" ON "CommunicationSuppression"("tenantId", "channel", "address");

-- AddForeignKey
ALTER TABLE "CommunicationSuppression" ADD CONSTRAINT "CommunicationSuppression_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

