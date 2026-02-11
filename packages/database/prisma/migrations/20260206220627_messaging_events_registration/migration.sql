-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('GENERAL', 'MESSAGE', 'EVENT', 'VOLUNTEER', 'GIVING', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "ConversationMemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('MEMBER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EventRsvpStatus" AS ENUM ('GOING', 'INTERESTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "EventRecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "eventSeriesId" TEXT,
ADD COLUMN     "requiresRsvp" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MemberRegistration" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "MemberRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "campusId" TEXT,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT,
    "frequency" "EventRecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekdays" "Weekday"[],
    "dayOfMonth" INTEGER,
    "requiresRsvp" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "ConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "MessageSenderType" NOT NULL,
    "senderMemberId" TEXT,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "provider" TEXT,
    "token" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberRegistration_churchId_idx" ON "MemberRegistration"("churchId");

-- CreateIndex
CREATE INDEX "MemberRegistration_email_idx" ON "MemberRegistration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRegistration_memberId_key" ON "MemberRegistration"("memberId");

-- CreateIndex
CREATE INDEX "EventSeries_churchId_idx" ON "EventSeries"("churchId");

-- CreateIndex
CREATE INDEX "EventRsvp_eventId_idx" ON "EventRsvp"("eventId");

-- CreateIndex
CREATE INDEX "EventRsvp_memberId_idx" ON "EventRsvp"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_eventId_memberId_key" ON "EventRsvp"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "Conversation_churchId_idx" ON "Conversation"("churchId");

-- CreateIndex
CREATE INDEX "ConversationMember_memberId_idx" ON "ConversationMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_memberId_key" ON "ConversationMember"("conversationId", "memberId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderMemberId_idx" ON "Message"("senderMemberId");

-- CreateIndex
CREATE INDEX "NotificationPreference_memberId_idx" ON "NotificationPreference"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_memberId_channel_key" ON "NotificationPreference"("memberId", "channel");

-- CreateIndex
CREATE INDEX "InAppNotification_churchId_idx" ON "InAppNotification"("churchId");

-- CreateIndex
CREATE INDEX "InAppNotification_memberId_idx" ON "InAppNotification"("memberId");

-- CreateIndex
CREATE INDEX "DeviceToken_memberId_idx" ON "DeviceToken"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_memberId_token_key" ON "DeviceToken"("memberId", "token");

-- AddForeignKey
ALTER TABLE "MemberRegistration" ADD CONSTRAINT "MemberRegistration_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRegistration" ADD CONSTRAINT "MemberRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_eventSeriesId_fkey" FOREIGN KEY ("eventSeriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderMemberId_fkey" FOREIGN KEY ("senderMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
