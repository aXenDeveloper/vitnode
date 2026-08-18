-- `example.article` moved from a hand-rolled `status` enum + `publishedAt`
-- field to the generated `publication` columns. The column names and types line
-- up, so the data survives - except for `archived`, which the generated status
-- does not have. Those rows become drafts.
UPDATE "example_articles" SET "status" = 'draft' WHERE "status" NOT IN ('draft', 'published');--> statement-breakpoint
ALTER TABLE "example_articles" ALTER COLUMN "status" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "example_articles" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
CREATE INDEX "example_articles_status_published_at_idx" ON "example_articles" USING btree ("status","publishedAt");--> statement-breakpoint
-- The engine's invariant: a published row always carries a publication date.
UPDATE "example_articles" SET "publishedAt" = "createdAt" WHERE "status" = 'published' AND "publishedAt" IS NULL;
