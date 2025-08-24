ALTER TABLE "core_users_forgot_password" ADD COLUMN "ipAddress" varchar(40) NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users_forgot_password" DROP COLUMN "ip_address";