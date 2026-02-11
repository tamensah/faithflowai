-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "pledgeId" TEXT;
ALTER TABLE "Donation" ADD COLUMN     "recurringDonationId" TEXT;

-- CreateIndex
CREATE INDEX "Donation_pledgeId_idx" ON "Donation"("pledgeId");

-- CreateIndex
CREATE INDEX "Donation_recurringDonationId_idx" ON "Donation"("recurringDonationId");

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_recurringDonationId_fkey" FOREIGN KEY ("recurringDonationId") REFERENCES "RecurringDonation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
