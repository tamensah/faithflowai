-- Public event, fundraiser, and giving URLs resolve churches by slug alone.
-- The slug must therefore identify one church across all organizations.
DROP INDEX "Church_organizationId_slug_key";
CREATE UNIQUE INDEX "Church_slug_key" ON "Church"("slug");
