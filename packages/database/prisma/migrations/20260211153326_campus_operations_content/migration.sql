-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('SANCTUARY', 'CLASSROOM', 'OFFICE', 'HALL', 'OUTDOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilityBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CareRequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CareRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CareRequestChannel" AS ENUM ('WEB', 'MOBILE', 'STAFF', 'REFERRAL');

-- CreateEnum
CREATE TYPE "SermonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentResourceType" AS ENUM ('DOCUMENT', 'VIDEO', 'AUDIO', 'LINK', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentResourceVisibility" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'LEADERS_ONLY', 'PRIVATE');

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "campusId" TEXT,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "capacity" INTEGER,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityBooking" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "eventId" TEXT,
    "bookedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "FacilityBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareRequest" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "campusId" TEXT,
    "memberId" TEXT,
    "requestedByMemberId" TEXT,
    "assignedToUserId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "CareRequestStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CareRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "channel" "CareRequestChannel" NOT NULL DEFAULT 'WEB',
    "dueAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareNote" (
    "id" TEXT NOT NULL,
    "careRequestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorMemberId" TEXT,
    "note" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sermon" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "campusId" TEXT,
    "eventId" TEXT,
    "mediaAssetId" TEXT,
    "title" TEXT NOT NULL,
    "speaker" TEXT,
    "seriesName" TEXT,
    "summary" TEXT,
    "scriptureRefs" JSONB,
    "durationSeconds" INTEGER,
    "status" "SermonStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sermon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentResource" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "campusId" TEXT,
    "mediaAssetId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ContentResourceType" NOT NULL DEFAULT 'DOCUMENT',
    "visibility" "ContentResourceVisibility" NOT NULL DEFAULT 'MEMBERS_ONLY',
    "linkUrl" TEXT,
    "tags" JSONB,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Facility_churchId_idx" ON "Facility"("churchId");

-- CreateIndex
CREATE INDEX "Facility_campusId_idx" ON "Facility"("campusId");

-- CreateIndex
CREATE INDEX "Facility_type_idx" ON "Facility"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_churchId_name_key" ON "Facility"("churchId", "name");

-- CreateIndex
CREATE INDEX "FacilityBooking_churchId_idx" ON "FacilityBooking"("churchId");

-- CreateIndex
CREATE INDEX "FacilityBooking_facilityId_startAt_idx" ON "FacilityBooking"("facilityId", "startAt");

-- CreateIndex
CREATE INDEX "FacilityBooking_eventId_idx" ON "FacilityBooking"("eventId");

-- CreateIndex
CREATE INDEX "FacilityBooking_status_idx" ON "FacilityBooking"("status");

-- CreateIndex
CREATE INDEX "CareRequest_churchId_idx" ON "CareRequest"("churchId");

-- CreateIndex
CREATE INDEX "CareRequest_campusId_idx" ON "CareRequest"("campusId");

-- CreateIndex
CREATE INDEX "CareRequest_memberId_idx" ON "CareRequest"("memberId");

-- CreateIndex
CREATE INDEX "CareRequest_assignedToUserId_idx" ON "CareRequest"("assignedToUserId");

-- CreateIndex
CREATE INDEX "CareRequest_status_priority_idx" ON "CareRequest"("status", "priority");

-- CreateIndex
CREATE INDEX "CareNote_careRequestId_createdAt_idx" ON "CareNote"("careRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "CareNote_authorUserId_idx" ON "CareNote"("authorUserId");

-- CreateIndex
CREATE INDEX "CareNote_authorMemberId_idx" ON "CareNote"("authorMemberId");

-- CreateIndex
CREATE INDEX "Sermon_churchId_idx" ON "Sermon"("churchId");

-- CreateIndex
CREATE INDEX "Sermon_campusId_idx" ON "Sermon"("campusId");

-- CreateIndex
CREATE INDEX "Sermon_eventId_idx" ON "Sermon"("eventId");

-- CreateIndex
CREATE INDEX "Sermon_status_idx" ON "Sermon"("status");

-- CreateIndex
CREATE INDEX "ContentResource_churchId_idx" ON "ContentResource"("churchId");

-- CreateIndex
CREATE INDEX "ContentResource_campusId_idx" ON "ContentResource"("campusId");

-- CreateIndex
CREATE INDEX "ContentResource_type_visibility_idx" ON "ContentResource"("type", "visibility");

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_bookedByUserId_fkey" FOREIGN KEY ("bookedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_requestedByMemberId_fkey" FOREIGN KEY ("requestedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareRequest" ADD CONSTRAINT "CareRequest_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareNote" ADD CONSTRAINT "CareNote_careRequestId_fkey" FOREIGN KEY ("careRequestId") REFERENCES "CareRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareNote" ADD CONSTRAINT "CareNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareNote" ADD CONSTRAINT "CareNote_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sermon" ADD CONSTRAINT "Sermon_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sermon" ADD CONSTRAINT "Sermon_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sermon" ADD CONSTRAINT "Sermon_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sermon" ADD CONSTRAINT "Sermon_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentResource" ADD CONSTRAINT "ContentResource_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentResource" ADD CONSTRAINT "ContentResource_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentResource" ADD CONSTRAINT "ContentResource_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
