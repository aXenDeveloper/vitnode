CREATE TABLE "core_content_containers" (
	"id" serial PRIMARY KEY,
	"pluginId" varchar(255) NOT NULL,
	"definitionId" varchar(100) NOT NULL,
	"parentId" integer,
	"name" varchar(255) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_containers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "example_discussions" ADD COLUMN "board" integer;--> statement-breakpoint
-- Discussions written before boards existed are filed under a "General" board,
-- created only when there is something to file, so the column can be NOT NULL.
INSERT INTO "core_content_containers" ("pluginId", "definitionId", "name", "slug", "position")
SELECT '@vitnode/example', 'example.boards', 'General', 'general', 0
WHERE EXISTS (SELECT 1 FROM "example_discussions");--> statement-breakpoint
UPDATE "example_discussions" SET "board" = (
	SELECT "id" FROM "core_content_containers"
	WHERE "definitionId" = 'example.boards' AND "slug" = 'general'
) WHERE "board" IS NULL;--> statement-breakpoint
ALTER TABLE "example_discussions" ALTER COLUMN "board" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_containers_definition_slug_key" ON "core_content_containers" ("definitionId","slug");--> statement-breakpoint
CREATE INDEX "core_content_containers_definition_parent_position_idx" ON "core_content_containers" ("definitionId","parentId","position");--> statement-breakpoint
CREATE INDEX "core_content_containers_parent_idx" ON "core_content_containers" ("parentId");--> statement-breakpoint
CREATE INDEX "example_discussions_board_published_at_idx" ON "example_discussions" ("board","publishedAt");--> statement-breakpoint
ALTER TABLE "core_content_containers" ADD CONSTRAINT "core_content_containers_q6QIucJ4HJ7B_fkey" FOREIGN KEY ("parentId") REFERENCES "core_content_containers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "example_discussions" ADD CONSTRAINT "example_discussions_board_core_content_containers_id_fkey" FOREIGN KEY ("board") REFERENCES "core_content_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;