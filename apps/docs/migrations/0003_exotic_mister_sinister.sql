CREATE TABLE "core_cron" (
	"name" varchar(255) PRIMARY KEY NOT NULL,
	"description" varchar(255),
	"lastRun" timestamp,
	CONSTRAINT "core_cron_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "core_cron" ENABLE ROW LEVEL SECURITY;