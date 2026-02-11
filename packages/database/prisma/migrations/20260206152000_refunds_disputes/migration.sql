-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "donationId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "currency" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceDueBy" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_provider_providerRef_key" ON "Refund"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "Refund_churchId_idx" ON "Refund"("churchId");

-- CreateIndex
CREATE INDEX "Refund_donationId_idx" ON "Refund"("donationId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_provider_providerRef_key" ON "Dispute"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "Dispute_churchId_idx" ON "Dispute"("churchId");

-- CreateIndex
CREATE INDEX "Dispute_donationId_idx" ON "Dispute"("donationId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
