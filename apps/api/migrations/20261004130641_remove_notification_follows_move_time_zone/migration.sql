DROP TABLE "core_notification_subscriptions";--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "timeZone" varchar(64);--> statement-breakpoint
UPDATE "core_users" AS u SET "timeZone" = s."timeZone" FROM "core_notification_user_state" AS s WHERE s."userId" = u."id" AND s."timeZone" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "core_notification_events" DROP COLUMN "followersOf";--> statement-breakpoint
ALTER TABLE "core_notification_events" DROP COLUMN "followerSubjectCursor";--> statement-breakpoint
ALTER TABLE "core_notification_events" DROP COLUMN "followerUserCursor";--> statement-breakpoint
ALTER TABLE "core_notification_user_state" DROP COLUMN "timeZone";