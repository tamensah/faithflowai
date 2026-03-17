-- CreateTable
CREATE TABLE "KBArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KBArticle_slug_key" ON "KBArticle"("slug");

-- CreateIndex
CREATE INDEX "KBArticle_published_category_idx" ON "KBArticle"("published", "category");

-- CreateIndex
CREATE INDEX "KBArticle_published_updatedAt_idx" ON "KBArticle"("published", "updatedAt");
