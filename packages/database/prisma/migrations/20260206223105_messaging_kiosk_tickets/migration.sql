-- CreateEnum
CREATE TYPE "TicketOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'REFUNDED');

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "typingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "checkInCode" TEXT,
ADD COLUMN     "checkInEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachments" JSONB;

-- CreateTable
CREATE TABLE "EventTicketType" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTicketOrder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT,
    "memberId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "paymentIntentId" TEXT,
    "status" "TicketOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTicketOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTicketType_eventId_idx" ON "EventTicketType"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTicketOrder_paymentIntentId_key" ON "EventTicketOrder"("paymentIntentId");

-- CreateIndex
CREATE INDEX "EventTicketOrder_eventId_idx" ON "EventTicketOrder"("eventId");

-- CreateIndex
CREATE INDEX "EventTicketOrder_memberId_idx" ON "EventTicketOrder"("memberId");

-- CreateIndex
CREATE INDEX "EventTicketOrder_paymentIntentId_idx" ON "EventTicketOrder"("paymentIntentId");

-- AddForeignKey
ALTER TABLE "EventTicketType" ADD CONSTRAINT "EventTicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketOrder" ADD CONSTRAINT "EventTicketOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketOrder" ADD CONSTRAINT "EventTicketOrder_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "EventTicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketOrder" ADD CONSTRAINT "EventTicketOrder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicketOrder" ADD CONSTRAINT "EventTicketOrder_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
