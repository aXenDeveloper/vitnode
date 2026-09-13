ALTER TABLE "core_roles" ADD COLUMN "allowEditPersonalInfo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "firstName" varchar(128);--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "lastName" varchar(128);--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "headline" varchar(100);--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "showRealName" boolean DEFAULT false NOT NULL;