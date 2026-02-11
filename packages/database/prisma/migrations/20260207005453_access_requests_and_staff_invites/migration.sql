-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "StaffInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "MemberAccessRequest" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "message" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "memberId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deniedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "invitedByClerkUserId" TEXT,
    "clerkInvitationId" TEXT,
    "status" "StaffInviteStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberAccessRequest_churchId_idx" ON "MemberAccessRequest"("churchId");

-- CreateIndex
CREATE INDEX "MemberAccessRequest_status_idx" ON "MemberAccessRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MemberAccessRequest_churchId_clerkUserId_key" ON "MemberAccessRequest"("churchId", "clerkUserId");

-- CreateIndex
CREATE INDEX "StaffInvite_churchId_idx" ON "StaffInvite"("churchId");

-- CreateIndex
CREATE INDEX "StaffInvite_status_idx" ON "StaffInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvite_churchId_email_key" ON "StaffInvite"("churchId", "email");

-- AddForeignKey
ALTER TABLE "MemberAccessRequest" ADD CONSTRAINT "MemberAccessRequest_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAccessRequest" ADD CONSTRAINT "MemberAccessRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
