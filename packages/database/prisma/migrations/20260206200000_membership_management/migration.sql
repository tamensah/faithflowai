-- CreateEnum
CREATE TYPE "MemberGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "MemberMaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "MemberMilestoneType" AS ENUM ('BAPTISM', 'CONFIRMATION', 'MEMBERSHIP', 'SALVATION', 'FIRST_COMMUNION', 'OTHER');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('SMALL_GROUP', 'MINISTRY', 'TEAM', 'CLASS');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('LEADER', 'CO_LEADER', 'MEMBER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "VolunteerRoleStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VolunteerAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_churchId_fkey";

-- DropForeignKey
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_churchId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationDripCampaign" DROP CONSTRAINT "CommunicationDripCampaign_churchId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationDripEnrollment" DROP CONSTRAINT "CommunicationDripEnrollment_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationDripEnrollment" DROP CONSTRAINT "CommunicationDripEnrollment_churchId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationDripStep" DROP CONSTRAINT "CommunicationDripStep_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationMessage" DROP CONSTRAINT "CommunicationMessage_churchId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationSchedule" DROP CONSTRAINT "CommunicationSchedule_churchId_fkey";

-- DropForeignKey
ALTER TABLE "CommunicationTemplate" DROP CONSTRAINT "CommunicationTemplate_churchId_fkey";

-- DropForeignKey
ALTER TABLE "Dispute" DROP CONSTRAINT "Dispute_churchId_fkey";

-- DropForeignKey
ALTER TABLE "DisputeEvidence" DROP CONSTRAINT "DisputeEvidence_disputeId_fkey";

-- DropForeignKey
ALTER TABLE "DonationReceipt" DROP CONSTRAINT "DonationReceipt_churchId_fkey";

-- DropForeignKey
ALTER TABLE "DonationReceipt" DROP CONSTRAINT "DonationReceipt_donationId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_churchId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT "ExpenseCategory_churchId_fkey";

-- DropForeignKey
ALTER TABLE "Fund" DROP CONSTRAINT "Fund_churchId_fkey";

-- DropForeignKey
ALTER TABLE "FundraiserPage" DROP CONSTRAINT "FundraiserPage_churchId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentIntent" DROP CONSTRAINT "PaymentIntent_churchId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutTransaction" DROP CONSTRAINT "PayoutTransaction_payoutId_fkey";

-- DropForeignKey
ALTER TABLE "Pledge" DROP CONSTRAINT "Pledge_churchId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringDonation" DROP CONSTRAINT "RecurringDonation_churchId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_churchId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_donationId_fkey";

-- DropForeignKey
ALTER TABLE "TextToGiveNumber" DROP CONSTRAINT "TextToGiveNumber_churchId_fkey";

-- AlterTable
ALTER TABLE "Donation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "primaryMemberId" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "baptismDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "confirmationDate" TIMESTAMP(3),
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "gender" "MemberGender" NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "joinDate" TIMESTAMP(3),
ADD COLUMN     "maritalStatus" "MemberMaritalStatus" NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "preferredName" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "MemberTag" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberTagAssignment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberTagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberMilestone" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "MemberMilestoneType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'SMALL_GROUP',
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "location" TEXT,
    "meetingSchedule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerRole" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "VolunteerRoleStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerAssignment" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "VolunteerAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "VolunteerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberTag_churchId_idx" ON "MemberTag"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberTag_churchId_name_key" ON "MemberTag"("churchId", "name");

-- CreateIndex
CREATE INDEX "MemberTagAssignment_memberId_idx" ON "MemberTagAssignment"("memberId");

-- CreateIndex
CREATE INDEX "MemberTagAssignment_tagId_idx" ON "MemberTagAssignment"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberTagAssignment_memberId_tagId_key" ON "MemberTagAssignment"("memberId", "tagId");

-- CreateIndex
CREATE INDEX "MemberMilestone_memberId_idx" ON "MemberMilestone"("memberId");

-- CreateIndex
CREATE INDEX "MemberMilestone_type_idx" ON "MemberMilestone"("type");

-- CreateIndex
CREATE INDEX "Group_churchId_idx" ON "Group"("churchId");

-- CreateIndex
CREATE INDEX "Group_type_idx" ON "Group"("type");

-- CreateIndex
CREATE INDEX "GroupMember_memberId_idx" ON "GroupMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_memberId_key" ON "GroupMember"("groupId", "memberId");

-- CreateIndex
CREATE INDEX "VolunteerRole_churchId_idx" ON "VolunteerRole"("churchId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerRole_churchId_name_key" ON "VolunteerRole"("churchId", "name");

-- CreateIndex
CREATE INDEX "VolunteerAssignment_memberId_idx" ON "VolunteerAssignment"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerAssignment_roleId_memberId_key" ON "VolunteerAssignment"("roleId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Household_primaryMemberId_key" ON "Household"("primaryMemberId");

-- CreateIndex
CREATE INDEX "Household_primaryMemberId_idx" ON "Household"("primaryMemberId");

-- CreateIndex
CREATE INDEX "Member_lastName_idx" ON "Member"("lastName");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_primaryMemberId_fkey" FOREIGN KEY ("primaryMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTag" ADD CONSTRAINT "MemberTag_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTagAssignment" ADD CONSTRAINT "MemberTagAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTagAssignment" ADD CONSTRAINT "MemberTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "MemberTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMilestone" ADD CONSTRAINT "MemberMilestone_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerRole" ADD CONSTRAINT "VolunteerRole_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "VolunteerRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fund" ADD CONSTRAINT "Fund_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationReceipt" ADD CONSTRAINT "DonationReceipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationReceipt" ADD CONSTRAINT "DonationReceipt_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TextToGiveNumber" ADD CONSTRAINT "TextToGiveNumber_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationSchedule" ADD CONSTRAINT "CommunicationSchedule_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripCampaign" ADD CONSTRAINT "CommunicationDripCampaign_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripStep" ADD CONSTRAINT "CommunicationDripStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationDripCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripEnrollment" ADD CONSTRAINT "CommunicationDripEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationDripCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDripEnrollment" ADD CONSTRAINT "CommunicationDripEnrollment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundraiserPage" ADD CONSTRAINT "FundraiserPage_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDonation" ADD CONSTRAINT "RecurringDonation_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
