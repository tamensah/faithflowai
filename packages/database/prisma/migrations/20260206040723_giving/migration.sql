-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'STRIPE', 'PAYSTACK');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "fundId" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "campaignId" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "paymentIntentId" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "donorName" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "donorEmail" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "donorPhone" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Donation" ALTER COLUMN "provider" TYPE "PaymentProvider" USING (
  CASE
    WHEN lower("provider") = 'stripe' THEN 'STRIPE'
    WHEN lower("provider") = 'paystack' THEN 'PAYSTACK'
    ELSE 'MANUAL'
  END
)::"PaymentProvider";

-- CreateTable
CREATE TABLE "Fund" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" DECIMAL(65,30),
    "currency" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'REQUIRES_ACTION',
    "checkoutUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fund_churchId_name_key" ON "Fund"("churchId", "name");

-- CreateIndex
CREATE INDEX "Fund_churchId_idx" ON "Fund"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_churchId_name_key" ON "Campaign"("churchId", "name");

-- CreateIndex
CREATE INDEX "Campaign_churchId_idx" ON "Campaign"("churchId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_paymentIntentId_key" ON "Donation"("paymentIntentId");

-- CreateIndex
CREATE INDEX "Donation_fundId_idx" ON "Donation"("fundId");

-- CreateIndex
CREATE INDEX "Donation_campaignId_idx" ON "Donation"("campaignId");

-- CreateIndex
CREATE INDEX "Donation_paymentIntentId_idx" ON "Donation"("paymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentIntent_churchId_idx" ON "PaymentIntent"("churchId");

-- CreateIndex
CREATE INDEX "PaymentIntent_memberId_idx" ON "PaymentIntent"("memberId");

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_providerRef_idx" ON "PaymentIntent"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "Fund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
