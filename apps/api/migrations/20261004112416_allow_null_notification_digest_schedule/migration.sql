ALTER TABLE "core_notification_user_state" ALTER COLUMN "digestHour" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "core_notification_user_state" ALTER COLUMN "digestHour" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "core_notification_user_state" ALTER COLUMN "digestWeekday" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "core_notification_user_state" ALTER COLUMN "digestWeekday" DROP NOT NULL;--> statement-breakpoint
UPDATE "core_notification_user_state" SET "digestHour" = NULL, "digestWeekday" = NULL WHERE "digestHour" = 8 AND "digestWeekday" = 1;
