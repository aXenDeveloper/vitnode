ALTER TABLE "core_content_translation_settings" ALTER COLUMN "enabled" SET DEFAULT true;--> statement-breakpoint
-- Rows written before the default changed (often by the cleanup cron) start on.
UPDATE "core_content_translation_settings" SET "enabled" = true WHERE "enabled" = false;