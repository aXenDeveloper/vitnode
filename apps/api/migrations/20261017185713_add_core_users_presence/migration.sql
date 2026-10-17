ALTER TABLE "core_users" ADD COLUMN "lastSeenAt" timestamp;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "hideOnlineStatus" boolean DEFAULT false NOT NULL;