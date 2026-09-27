ALTER TABLE "core_navigation" ADD COLUMN "location" varchar(16) DEFAULT 'header' NOT NULL;--> statement-breakpoint
CREATE INDEX "core_navigation_location_idx" ON "core_navigation" ("location");