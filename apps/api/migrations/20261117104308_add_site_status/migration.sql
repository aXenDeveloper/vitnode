CREATE TABLE "core_site_status" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"offline" boolean DEFAULT false NOT NULL,
	"message" jsonb DEFAULT '[]' NOT NULL,
	"opensAt" timestamp with time zone,
	"showCountdown" boolean DEFAULT true NOT NULL,
	"changedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"changedById" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_site_status" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_site_status" ADD CONSTRAINT "core_site_status_changedById_core_users_id_fkey" FOREIGN KEY ("changedById") REFERENCES "core_users"("id") ON DELETE SET NULL;