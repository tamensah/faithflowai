-- CreateTable
CREATE TABLE "TextToGiveNumber" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "fundId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextToGiveNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TextToGiveMessage" (
    "id" TEXT NOT NULL,
    "churchId" TEXT,
    "numberId" TEXT,
    "messageSid" TEXT,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "amount" DECIMAL(65,30),
    "currency" TEXT,
    "provider" "PaymentProvider",
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "checkoutUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TextToGiveMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "tenantId" TEXT,
    "churchId" TEXT,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutTransaction" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "tenantId" TEXT,
    "churchId" TEXT,
    "donationId" TEXT,
    "providerRef" TEXT NOT NULL,
    "sourceRef" TEXT,
    "type" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30),
    "net" DECIMAL(65,30),
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TextToGiveNumber_phoneNumber_key" ON "TextToGiveNumber"("phoneNumber");

-- CreateIndex
CREATE INDEX "TextToGiveNumber_churchId_idx" ON "TextToGiveNumber"("churchId");

-- CreateIndex
CREATE INDEX "TextToGiveNumber_provider_idx" ON "TextToGiveNumber"("provider");

-- CreateIndex
CREATE INDEX "TextToGiveMessage_churchId_idx" ON "TextToGiveMessage"("churchId");

-- CreateIndex
CREATE INDEX "TextToGiveMessage_numberId_idx" ON "TextToGiveMessage"("numberId");

-- CreateIndex
CREATE INDEX "TextToGiveMessage_status_idx" ON "TextToGiveMessage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_provider_providerRef_key" ON "Payout"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "Payout_tenantId_idx" ON "Payout"("tenantId");

-- CreateIndex
CREATE INDEX "Payout_churchId_idx" ON "Payout"("churchId");

-- CreateIndex
CREATE INDEX "Payout_provider_idx" ON "Payout"("provider");

-- CreateIndex
CREATE INDEX "PayoutTransaction_payoutId_idx" ON "PayoutTransaction"("payoutId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_tenantId_idx" ON "PayoutTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_churchId_idx" ON "PayoutTransaction"("churchId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_donationId_idx" ON "PayoutTransaction"("donationId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_providerRef_idx" ON "PayoutTransaction"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutTransaction_payoutId_providerRef_key" ON "PayoutTransaction"("payoutId", "providerRef");

-- CreateIndex
CREATE INDEX "PayoutTransaction_sourceRef_idx" ON "PayoutTransaction"("sourceRef");

-- AddForeignKey
ALTER TABLE "TextToGiveNumber" ADD CONSTRAINT "TextToGiveNumber_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextToGiveNumber" ADD CONSTRAINT "TextToGiveNumber_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextToGiveNumber" ADD CONSTRAINT "TextToGiveNumber_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextToGiveMessage" ADD CONSTRAINT "TextToGiveMessage_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextToGiveMessage" ADD CONSTRAINT "TextToGiveMessage_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "TextToGiveNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
