CREATE TYPE "public"."typeLogs" AS ENUM('info', 'warn', 'error', 'debug');--> statement-breakpoint
CREATE TABLE "core_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"pluginCode" varchar(255) NOT NULL,
	"type" "typeLogs" DEFAULT 'info' NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"userId" integer,
	"ipAddress" varchar(45) DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_logs" ADD CONSTRAINT "core_logs_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE no action;