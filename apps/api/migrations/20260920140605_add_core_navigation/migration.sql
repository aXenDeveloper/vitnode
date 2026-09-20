CREATE TABLE "core_navigation" (
	"id" serial PRIMARY KEY,
	"kind" varchar(16) NOT NULL,
	"pluginId" varchar(50),
	"presetId" varchar(120),
	"href" text,
	"isOpenInNewTab" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_navigation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_navigation_position_idx" ON "core_navigation" ("position");--> statement-breakpoint
INSERT INTO "core_navigation" ("kind", "pluginId", "presetId", "position") VALUES ('preset', '@vitnode/core', 'discover', 0), ('preset', '@vitnode/core', 'search', 1);
