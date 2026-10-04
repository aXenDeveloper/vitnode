ALTER TABLE "core_notification_user_state" DROP COLUMN "digestHour";--> statement-breakpoint
ALTER TABLE "core_notification_user_state" DROP COLUMN "digestWeekday";--> statement-breakpoint
UPDATE "core_notification_settings" SET "value" = "value" - 'digestHour' - 'digestWeekday' WHERE "key" = 'global';
