-- CreateEnum
CREATE TYPE "EventBadgeStatus" AS ENUM ('ACTIVE', 'REVOKED', 'USED');

-- CreateTable
CREATE TABLE "EventBadge" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT,
    "registrationId" TEXT,
    "ticketOrderId" TEXT,
    "badgeCode" TEXT NOT NULL,
    "sequence" INTEGER,
    "status" "EventBadgeStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "EventBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventBadge_badgeCode_key" ON "EventBadge"("badgeCode");

-- CreateIndex
CREATE INDEX "EventBadge_eventId_idx" ON "EventBadge"("eventId");

-- CreateIndex
CREATE INDEX "EventBadge_memberId_idx" ON "EventBadge"("memberId");

-- CreateIndex
CREATE INDEX "EventBadge_registrationId_idx" ON "EventBadge"("registrationId");

-- CreateIndex
CREATE INDEX "EventBadge_ticketOrderId_idx" ON "EventBadge"("ticketOrderId");

-- CreateIndex
CREATE INDEX "EventBadge_status_idx" ON "EventBadge"("status");

-- AddForeignKey
ALTER TABLE "EventBadge" ADD CONSTRAINT "EventBadge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBadge" ADD CONSTRAINT "EventBadge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBadge" ADD CONSTRAINT "EventBadge_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventBadge" ADD CONSTRAINT "EventBadge_ticketOrderId_fkey" FOREIGN KEY ("ticketOrderId") REFERENCES "EventTicketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
