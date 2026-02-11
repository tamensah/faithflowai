-- CreateEnum
CREATE TYPE "MemberDirectoryVisibility" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'LEADERS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "OnboardingWorkflowStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OnboardingStepType" AS ENUM ('WELCOME_CALL', 'CLASS', 'PROFILE_SETUP', 'GROUP_ASSIGNMENT', 'VOLUNTEER_ONBOARDING', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "directoryVisibility" "MemberDirectoryVisibility" NOT NULL DEFAULT 'MEMBERS_ONLY',
ADD COLUMN     "showAddressInDirectory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showEmailInDirectory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPhoneInDirectory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPhotoInDirectory" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OnboardingWorkflow" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OnboardingWorkflowStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OnboardingStepType" NOT NULL DEFAULT 'OTHER',
    "order" INTEGER NOT NULL,
    "description" TEXT,
    "dueDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberOnboarding" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MemberOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberOnboardingTask" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "MemberOnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingWorkflow_churchId_idx" ON "OnboardingWorkflow"("churchId");

-- CreateIndex
CREATE INDEX "OnboardingWorkflow_status_idx" ON "OnboardingWorkflow"("status");

-- CreateIndex
CREATE INDEX "OnboardingStep_workflowId_idx" ON "OnboardingStep"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStep_workflowId_order_key" ON "OnboardingStep"("workflowId", "order");

-- CreateIndex
CREATE INDEX "MemberOnboarding_memberId_idx" ON "MemberOnboarding"("memberId");

-- CreateIndex
CREATE INDEX "MemberOnboarding_workflowId_idx" ON "MemberOnboarding"("workflowId");

-- CreateIndex
CREATE INDEX "MemberOnboardingTask_onboardingId_idx" ON "MemberOnboardingTask"("onboardingId");

-- CreateIndex
CREATE INDEX "MemberOnboardingTask_stepId_idx" ON "MemberOnboardingTask"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOnboardingTask_onboardingId_stepId_key" ON "MemberOnboardingTask"("onboardingId", "stepId");

-- CreateIndex
CREATE INDEX "Event_groupId_idx" ON "Event"("groupId");

-- CreateIndex
CREATE INDEX "Member_directoryVisibility_idx" ON "Member"("directoryVisibility");

-- AddForeignKey
ALTER TABLE "OnboardingWorkflow" ADD CONSTRAINT "OnboardingWorkflow_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OnboardingWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberOnboarding" ADD CONSTRAINT "MemberOnboarding_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberOnboarding" ADD CONSTRAINT "MemberOnboarding_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OnboardingWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberOnboardingTask" ADD CONSTRAINT "MemberOnboardingTask_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "MemberOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberOnboardingTask" ADD CONSTRAINT "MemberOnboardingTask_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "OnboardingStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
