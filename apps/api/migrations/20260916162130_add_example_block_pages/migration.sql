CREATE TABLE "example_pages" (
	"id" serial PRIMARY KEY,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"content" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "example_pages_slug_key" ON "example_pages" ("slug");--> statement-breakpoint
CREATE INDEX "example_pages_created_at_idx" ON "example_pages" ("createdAt");--> statement-breakpoint
CREATE INDEX "example_pages_updated_at_idx" ON "example_pages" ("updatedAt");--> statement-breakpoint
CREATE INDEX "example_pages_status_published_at_idx" ON "example_pages" ("status","publishedAt");