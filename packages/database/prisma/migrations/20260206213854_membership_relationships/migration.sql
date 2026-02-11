-- CreateEnum
CREATE TYPE "MemberRelationshipType" AS ENUM ('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'GUARDIAN', 'MENTOR', 'DISCIPLE', 'FRIEND', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VolunteerAvailability" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "roleId" TEXT,
    "dayOfWeek" "Weekday" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRelationship" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "type" "MemberRelationshipType" NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerAvailability_churchId_idx" ON "VolunteerAvailability"("churchId");

-- CreateIndex
CREATE INDEX "VolunteerAvailability_memberId_idx" ON "VolunteerAvailability"("memberId");

-- CreateIndex
CREATE INDEX "VolunteerAvailability_roleId_idx" ON "VolunteerAvailability"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerAvailability_memberId_roleId_dayOfWeek_startTime_e_key" ON "VolunteerAvailability"("memberId", "roleId", "dayOfWeek", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "MemberRelationship_churchId_idx" ON "MemberRelationship"("churchId");

-- CreateIndex
CREATE INDEX "MemberRelationship_fromMemberId_idx" ON "MemberRelationship"("fromMemberId");

-- CreateIndex
CREATE INDEX "MemberRelationship_toMemberId_idx" ON "MemberRelationship"("toMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRelationship_fromMemberId_toMemberId_type_key" ON "MemberRelationship"("fromMemberId", "toMemberId", "type");

-- AddForeignKey
ALTER TABLE "VolunteerAvailability" ADD CONSTRAINT "VolunteerAvailability_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAvailability" ADD CONSTRAINT "VolunteerAvailability_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAvailability" ADD CONSTRAINT "VolunteerAvailability_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "VolunteerRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRelationship" ADD CONSTRAINT "MemberRelationship_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRelationship" ADD CONSTRAINT "MemberRelationship_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRelationship" ADD CONSTRAINT "MemberRelationship_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
