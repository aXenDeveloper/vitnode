CREATE TABLE "core_page_layouts" (
	"pageId" varchar(120) PRIMARY KEY,
	"zones" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_page_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "example_zones_layouts";