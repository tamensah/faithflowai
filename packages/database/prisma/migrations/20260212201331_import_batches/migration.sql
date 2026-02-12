-- CreateEnum
CREATE TYPE "ImportEntityType" AS ENUM ('MEMBER', 'HOUSEHOLD', 'DONATION');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('APPLIED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportItemAction" AS ENUM ('CREATED', 'UPDATED');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "entityType" "ImportEntityType" NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'APPLIED',
    "filename" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdByClerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "entityType" "ImportEntityType" NOT NULL,
    "action" "ImportItemAction" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_tenantId_createdAt_idx" ON "ImportBatch"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_churchId_createdAt_idx" ON "ImportBatch"("churchId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_entityType_createdAt_idx" ON "ImportBatch"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatchItem_batchId_idx" ON "ImportBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "ImportBatchItem_entityType_entityId_idx" ON "ImportBatchItem"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatchItem" ADD CONSTRAINT "ImportBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
