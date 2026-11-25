CREATE TABLE "core_cron_heartbeats" (
	"slot" timestamp PRIMARY KEY,
	"ticks" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_cron_heartbeats" ENABLE ROW LEVEL SECURITY;