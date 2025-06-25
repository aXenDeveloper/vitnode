ALTER TABLE "core_logs" ADD COLUMN "method" varchar(10) DEFAULT 'GET' NOT NULL;--> statement-breakpoint
ALTER TABLE "core_logs" ADD COLUMN "path" text DEFAULT 'localhost' NOT NULL;--> statement-breakpoint
ALTER TABLE "core_logs" ADD COLUMN "userAgent" text;--> statement-breakpoint
ALTER TABLE "core_logs" ADD COLUMN "statusCode" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "core_logs" ADD COLUMN "userId" bigint;--> statement-breakpoint
ALTER TABLE "core_logs" ADD CONSTRAINT "core_logs_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE cascade;