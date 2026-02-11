-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SERVICE', 'BIBLE_STUDY', 'FUNDRAISER', 'CEREMONY', 'MEETING', 'CONFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'LEADERS_ONLY');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EventAssignmentRole" AS ENUM ('SPEAKER', 'HOST', 'WORSHIP_LEADER', 'VOLUNTEER', 'TECH', 'OTHER');

-- CreateEnum
CREATE TYPE "EventMediaType" AS ENUM ('PHOTO', 'VIDEO', 'SERMON', 'DOCUMENT', 'OTHER');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "allowGuestRegistration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "format" "EventFormat" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "registrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationFields" JSONB,
ADD COLUMN     "registrationLimit" INTEGER,
ADD COLUMN     "type" "EventType" NOT NULL DEFAULT 'SERVICE',
ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventSeries" ADD COLUMN     "allowGuestRegistration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "format" "EventFormat" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "registrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationFields" JSONB,
ADD COLUMN     "registrationLimit" INTEGER,
ADD COLUMN     "type" "EventType" NOT NULL DEFAULT 'SERVICE',
ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "responses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAssignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT,
    "role" "EventAssignmentRole" NOT NULL,
    "displayName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMedia" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "EventMediaType" NOT NULL DEFAULT 'PHOTO',
    "title" TEXT,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_memberId_idx" ON "EventRegistration"("memberId");

-- CreateIndex
CREATE INDEX "EventRegistration_guestEmail_idx" ON "EventRegistration"("guestEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_eventId_memberId_key" ON "EventRegistration"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "EventAssignment_eventId_idx" ON "EventAssignment"("eventId");

-- CreateIndex
CREATE INDEX "EventAssignment_memberId_idx" ON "EventAssignment"("memberId");

-- CreateIndex
CREATE INDEX "EventMedia_eventId_idx" ON "EventMedia"("eventId");

-- CreateIndex
CREATE INDEX "EventMedia_assetId_idx" ON "EventMedia"("assetId");

-- CreateIndex
CREATE INDEX "EventMedia_churchId_idx" ON "EventMedia"("churchId");

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAssignment" ADD CONSTRAINT "EventAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAssignment" ADD CONSTRAINT "EventAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMedia" ADD CONSTRAINT "EventMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
