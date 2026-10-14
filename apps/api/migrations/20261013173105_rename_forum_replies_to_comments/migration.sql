ALTER TABLE "forum_replies" RENAME TO "forum_comments";--> statement-breakpoint
ALTER INDEX "forum_replies_topic_parent_created_at_idx" RENAME TO "forum_comments_topic_parent_created_at_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_slug_key" RENAME TO "forum_comments_slug_key";--> statement-breakpoint
ALTER INDEX "forum_replies_author_idx" RENAME TO "forum_comments_author_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_topic_idx" RENAME TO "forum_comments_topic_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_parent_idx" RENAME TO "forum_comments_parent_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_created_at_idx" RENAME TO "forum_comments_created_at_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_updated_at_idx" RENAME TO "forum_comments_updated_at_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_status_published_at_idx" RENAME TO "forum_comments_status_published_at_idx";--> statement-breakpoint
ALTER INDEX "forum_replies_hidden_by_idx" RENAME TO "forum_comments_hidden_by_idx";--> statement-breakpoint
CREATE INDEX "core_search_index_container_idx" ON "core_search_index" ("containerType","containerId");--> statement-breakpoint
UPDATE "core_content_revisions" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_content_submissions" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_content_schedules" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_content_slug_history" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_content_documents" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_content_drafts" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_content_field_locks" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_ai_translation_sources" SET "contentTypeId" = 'forum.comment' WHERE "contentTypeId" = 'forum.reply';--> statement-breakpoint
UPDATE "core_moderation_reports" SET "targetType" = 'forum.comment' WHERE "targetType" = 'forum.reply';--> statement-breakpoint
DELETE FROM "core_search_index" WHERE "itemType" = 'forum.reply';
