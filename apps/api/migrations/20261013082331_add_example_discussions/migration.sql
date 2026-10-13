CREATE TABLE "example_discussions" (
	"id" serial PRIMARY KEY,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"hiddenAt" timestamp,
	"hiddenBy" integer,
	"title" varchar(200) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"body" jsonb NOT NULL,
	"author" integer
);
--> statement-breakpoint
ALTER TABLE "example_discussions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "example_discussions_slug_key" ON "example_discussions" ("slug");--> statement-breakpoint
CREATE INDEX "example_discussions_author_idx" ON "example_discussions" ("author");--> statement-breakpoint
CREATE INDEX "example_discussions_created_at_idx" ON "example_discussions" ("createdAt");--> statement-breakpoint
CREATE INDEX "example_discussions_updated_at_idx" ON "example_discussions" ("updatedAt");--> statement-breakpoint
CREATE INDEX "example_discussions_status_published_at_idx" ON "example_discussions" ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "example_discussions_hidden_by_idx" ON "example_discussions" ("hiddenBy");--> statement-breakpoint
ALTER TABLE "example_discussions" ADD CONSTRAINT "example_discussions_hiddenBy_core_users_id_fkey" FOREIGN KEY ("hiddenBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "example_discussions" ADD CONSTRAINT "example_discussions_author_core_users_id_fkey" FOREIGN KEY ("author") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;