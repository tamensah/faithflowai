-- CreateEnum
CREATE TYPE "VolunteerShiftAssignmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'TEXT', 'RATING');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "clerkUserId" TEXT;

-- CreateTable
CREATE TABLE "VolunteerShift" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "VolunteerShiftAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReminderAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "VolunteerShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "SurveyQuestionType" NOT NULL DEFAULT 'TEXT',
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "memberId" TEXT,
    "respondentName" TEXT,
    "respondentEmail" TEXT,
    "respondentPhone" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerShift_churchId_idx" ON "VolunteerShift"("churchId");

-- CreateIndex
CREATE INDEX "VolunteerShift_roleId_idx" ON "VolunteerShift"("roleId");

-- CreateIndex
CREATE INDEX "VolunteerShift_startAt_idx" ON "VolunteerShift"("startAt");

-- CreateIndex
CREATE INDEX "VolunteerShiftAssignment_memberId_idx" ON "VolunteerShiftAssignment"("memberId");

-- CreateIndex
CREATE INDEX "VolunteerShiftAssignment_status_idx" ON "VolunteerShiftAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerShiftAssignment_shiftId_memberId_key" ON "VolunteerShiftAssignment"("shiftId", "memberId");

-- CreateIndex
CREATE INDEX "Survey_churchId_idx" ON "Survey"("churchId");

-- CreateIndex
CREATE INDEX "Survey_status_idx" ON "Survey"("status");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestion_surveyId_order_key" ON "SurveyQuestion"("surveyId", "order");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_memberId_idx" ON "SurveyResponse"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_clerkUserId_key" ON "Member"("clerkUserId");

-- AddForeignKey
ALTER TABLE "VolunteerShift" ADD CONSTRAINT "VolunteerShift_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShift" ADD CONSTRAINT "VolunteerShift_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "VolunteerRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShiftAssignment" ADD CONSTRAINT "VolunteerShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "VolunteerShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerShiftAssignment" ADD CONSTRAINT "VolunteerShiftAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
