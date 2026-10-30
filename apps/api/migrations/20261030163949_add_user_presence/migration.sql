ALTER TABLE "core_roles" ADD COLUMN "allowBrowseAnonymously" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "forceBrowseAnonymously" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "lastSeenAt" timestamp;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "hideOnlineStatus" boolean DEFAULT false NOT NULL;