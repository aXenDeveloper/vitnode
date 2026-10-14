CREATE TABLE "core_content_submissions" (
	"id" serial PRIMARY KEY,
	"pluginId" varchar(255) NOT NULL,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" varchar(64) NOT NULL,
	"containerDefinitionId" varchar(100),
	"containerId" integer,
	"kind" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"values" jsonb DEFAULT '{}' NOT NULL,
	"baseValues" jsonb,
	"baseVersion" integer,
	"baseUpdatedAt" timestamp,
	"authorId" integer,
	"reviewerId" integer,
	"reason" text,
	"revisionId" integer,
	"decidedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" serial PRIMARY KEY,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"hiddenAt" timestamp,
	"hiddenBy" integer,
	"slug" varchar(160) NOT NULL,
	"body" jsonb NOT NULL,
	"author" integer,
	"topic" integer NOT NULL,
	"parent" integer
);
--> statement-breakpoint
ALTER TABLE "forum_replies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "forum_topics" (
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
	"author" integer,
	"forum" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forum_topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_content_containers" ADD COLUMN "policies" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_submissions_pending_key" ON "core_content_submissions" ("contentTypeId","itemId") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "core_content_submissions_queue_idx" ON "core_content_submissions" ("status","contentTypeId","containerId","createdAt");--> statement-breakpoint
CREATE INDEX "core_content_submissions_item_idx" ON "core_content_submissions" ("contentTypeId","itemId");--> statement-breakpoint
CREATE INDEX "core_content_submissions_author_idx" ON "core_content_submissions" ("authorId","createdAt");--> statement-breakpoint
CREATE INDEX "forum_replies_topic_parent_created_at_idx" ON "forum_replies" ("topic","parent","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_replies_slug_key" ON "forum_replies" ("slug");--> statement-breakpoint
CREATE INDEX "forum_replies_author_idx" ON "forum_replies" ("author");--> statement-breakpoint
CREATE INDEX "forum_replies_topic_idx" ON "forum_replies" ("topic");--> statement-breakpoint
CREATE INDEX "forum_replies_parent_idx" ON "forum_replies" ("parent");--> statement-breakpoint
CREATE INDEX "forum_replies_created_at_idx" ON "forum_replies" ("createdAt");--> statement-breakpoint
CREATE INDEX "forum_replies_updated_at_idx" ON "forum_replies" ("updatedAt");--> statement-breakpoint
CREATE INDEX "forum_replies_status_published_at_idx" ON "forum_replies" ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "forum_replies_hidden_by_idx" ON "forum_replies" ("hiddenBy");--> statement-breakpoint
CREATE INDEX "forum_topics_forum_published_at_idx" ON "forum_topics" ("forum","publishedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "forum_topics_slug_key" ON "forum_topics" ("slug");--> statement-breakpoint
CREATE INDEX "forum_topics_author_idx" ON "forum_topics" ("author");--> statement-breakpoint
CREATE INDEX "forum_topics_created_at_idx" ON "forum_topics" ("createdAt");--> statement-breakpoint
CREATE INDEX "forum_topics_updated_at_idx" ON "forum_topics" ("updatedAt");--> statement-breakpoint
CREATE INDEX "forum_topics_status_published_at_idx" ON "forum_topics" ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "forum_topics_hidden_by_idx" ON "forum_topics" ("hiddenBy");--> statement-breakpoint
ALTER TABLE "core_content_submissions" ADD CONSTRAINT "core_content_submissions_authorId_core_users_id_fkey" FOREIGN KEY ("authorId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_content_submissions" ADD CONSTRAINT "core_content_submissions_reviewerId_core_users_id_fkey" FOREIGN KEY ("reviewerId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_hiddenBy_core_users_id_fkey" FOREIGN KEY ("hiddenBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_core_users_id_fkey" FOREIGN KEY ("author") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_topic_forum_topics_id_fkey" FOREIGN KEY ("topic") REFERENCES "forum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_parent_forum_replies_id_fkey" FOREIGN KEY ("parent") REFERENCES "forum_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_hiddenBy_core_users_id_fkey" FOREIGN KEY ("hiddenBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_author_core_users_id_fkey" FOREIGN KEY ("author") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_forum_core_content_containers_id_fkey" FOREIGN KEY ("forum") REFERENCES "core_content_containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;