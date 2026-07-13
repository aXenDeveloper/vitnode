ALTER TABLE "core_admin_permissions" ADD COLUMN "unrestricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD COLUMN "unrestricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "core_admin_permissions" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" DROP COLUMN "data";