-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('S3', 'GCS');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "uploaderMemberId" TEXT,
    "uploaderUserId" TEXT,
    "provider" "StorageProvider" NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_churchId_idx" ON "MediaAsset"("churchId");

-- CreateIndex
CREATE INDEX "MediaAsset_uploaderMemberId_idx" ON "MediaAsset"("uploaderMemberId");

-- CreateIndex
CREATE INDEX "MediaAsset_provider_idx" ON "MediaAsset"("provider");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploaderMemberId_fkey" FOREIGN KEY ("uploaderMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
