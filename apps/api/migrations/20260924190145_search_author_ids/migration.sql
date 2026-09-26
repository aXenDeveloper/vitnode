ALTER TABLE "core_search_index" DROP CONSTRAINT "core_search_index_authorId_core_users_id_fk";--> statement-breakpoint
DROP INDEX "core_search_index_author_id_idx";--> statement-breakpoint
ALTER TABLE "core_search_index" ADD COLUMN "authorIds" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
UPDATE "core_search_index" SET "authorIds" = ARRAY["authorId"] WHERE "authorId" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "core_search_index" DROP COLUMN "authorId";--> statement-breakpoint
CREATE INDEX "core_search_index_author_ids_idx" ON "core_search_index" USING gin ("authorIds");