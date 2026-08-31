ALTER TABLE "core_admin_permissions" ADD COLUMN "unrestricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD COLUMN "unrestricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "core_admin_permissions" SET "unrestricted" = COALESCE(("data"->>'unrestricted')::boolean, false), "permissions" = COALESCE("data"->'permissions', '[]'::jsonb);--> statement-breakpoint
UPDATE "core_moderators_permissions" SET "unrestricted" = COALESCE(("data"->>'unrestricted')::boolean, false), "permissions" = COALESCE("data"->'permissions', '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "core_admin_permissions" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" DROP COLUMN "data";