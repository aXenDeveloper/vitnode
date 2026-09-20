CREATE TABLE "example_zones_layouts" (
	"id" serial PRIMARY KEY,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"beforeProfile" jsonb DEFAULT '[]' NOT NULL,
	"afterProfile" jsonb DEFAULT '[]' NOT NULL,
	"sidebar" jsonb DEFAULT '[]' NOT NULL,
	"beforeFooter" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_zones_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "example_zones_layouts_slug_key" ON "example_zones_layouts" ("slug");--> statement-breakpoint
CREATE INDEX "example_zones_layouts_created_at_idx" ON "example_zones_layouts" ("createdAt");--> statement-breakpoint
CREATE INDEX "example_zones_layouts_updated_at_idx" ON "example_zones_layouts" ("updatedAt");