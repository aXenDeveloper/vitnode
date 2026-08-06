DROP INDEX "example_localized_articles_translations_language_id_idx";--> statement-breakpoint
DROP INDEX "core_content_revisions_item_version_unique";--> statement-breakpoint
ALTER TABLE "core_content_revisions" ADD COLUMN "languageId" integer;--> statement-breakpoint
ALTER TABLE "example_localized_articles" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
ALTER TABLE "example_localized_articles" ADD COLUMN "status" varchar(32) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "example_localized_articles" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "example_localized_articles_translations" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
ALTER TABLE "example_localized_articles_translations" ADD COLUMN "status" varchar(32) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_revisions_translation_version_unique" ON "core_content_revisions" USING btree ("contentTypeId","itemId","languageId","version") WHERE "languageId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_content_revisions_language_idx" ON "core_content_revisions" USING btree ("contentTypeId","itemId","languageId","version");--> statement-breakpoint
CREATE INDEX "example_localized_articles_status_published_at_idx" ON "example_localized_articles" USING btree ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "example_localized_articles_translations_language_id_status_idx" ON "example_localized_articles_translations" USING btree ("languageId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_revisions_item_version_unique" ON "core_content_revisions" USING btree ("contentTypeId","itemId","version") WHERE "languageId" IS NULL;