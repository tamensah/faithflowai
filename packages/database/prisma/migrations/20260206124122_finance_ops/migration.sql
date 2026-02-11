-- CreateEnum
CREATE TYPE "RecurringInterval" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PledgeStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateTable
CREATE TABLE "DonationReceipt" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pledge" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PledgeStatus" NOT NULL DEFAULT 'ACTIVE',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringDonation" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "RecurringInterval" NOT NULL,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextChargeAt" TIMESTAMP(3),
    "lastChargeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "categoryId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "description" TEXT,
    "vendor" TEXT,
    "occurredAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DonationReceipt_donationId_key" ON "DonationReceipt"("donationId");

-- CreateIndex
CREATE UNIQUE INDEX "DonationReceipt_receiptNumber_key" ON "DonationReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "DonationReceipt_churchId_idx" ON "DonationReceipt"("churchId");

-- CreateIndex
CREATE INDEX "Pledge_churchId_idx" ON "Pledge"("churchId");

-- CreateIndex
CREATE INDEX "Pledge_memberId_idx" ON "Pledge"("memberId");

-- CreateIndex
CREATE INDEX "RecurringDonation_churchId_idx" ON "RecurringDonation"("churchId");

-- CreateIndex
CREATE INDEX "RecurringDonation_memberId_idx" ON "RecurringDonation"("memberId");

-- CreateIndex
CREATE INDEX "RecurringDonation_status_idx" ON "RecurringDonation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_churchId_name_key" ON "ExpenseCategory"("churchId", "name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_churchId_idx" ON "ExpenseCategory"("churchId");

-- CreateIndex
CREATE INDEX "Expense_churchId_idx" ON "Expense"("churchId");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Budget_churchId_idx" ON "Budget"("churchId");

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE INDEX "BudgetItem_budgetId_idx" ON "BudgetItem"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetItem_categoryId_idx" ON "BudgetItem"("categoryId");

-- AddForeignKey
ALTER TABLE "DonationReceipt" ADD CONSTRAINT "DonationReceipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationReceipt" ADD CONSTRAINT "DonationReceipt_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDonation" ADD CONSTRAINT "RecurringDonation_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDonation" ADD CONSTRAINT "RecurringDonation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
