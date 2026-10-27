CREATE TABLE "blog_comments" (
	"id" serial PRIMARY KEY,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"hiddenAt" timestamp,
	"hiddenBy" integer,
	"hiddenReason" varchar(500),
	"deletedAt" timestamp,
	"deletedBy" integer,
	"slug" varchar(160) NOT NULL,
	"body" jsonb NOT NULL,
	"author" integer,
	"article" integer NOT NULL,
	"parent" integer
);
--> statement-breakpoint
ALTER TABLE "blog_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowEditOwnContent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "editOwnContentMinutes" integer;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowDeleteOwnContent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowHideOwnContent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
ALTER TABLE "forum_comments" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
ALTER TABLE "forum_comments" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD COLUMN "deletedBy" integer;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
ALTER TABLE "newsroom_comments" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
ALTER TABLE "newsroom_comments" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "newsroom_comments" ADD COLUMN "deletedBy" integer;--> statement-breakpoint
ALTER TABLE "newsroom_events" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
ALTER TABLE "newsroom_letters" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
ALTER TABLE "newsroom_tags" ADD COLUMN "hiddenReason" varchar(500);--> statement-breakpoint
CREATE INDEX "blog_comments_article_parent_created_at_idx" ON "blog_comments" ("article","parent","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_comments_slug_key" ON "blog_comments" ("slug");--> statement-breakpoint
CREATE INDEX "blog_comments_author_idx" ON "blog_comments" ("author");--> statement-breakpoint
CREATE INDEX "blog_comments_article_idx" ON "blog_comments" ("article");--> statement-breakpoint
CREATE INDEX "blog_comments_parent_idx" ON "blog_comments" ("parent");--> statement-breakpoint
CREATE INDEX "blog_comments_created_at_idx" ON "blog_comments" ("createdAt");--> statement-breakpoint
CREATE INDEX "blog_comments_updated_at_idx" ON "blog_comments" ("updatedAt");--> statement-breakpoint
CREATE INDEX "blog_comments_status_published_at_idx" ON "blog_comments" ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "blog_comments_hidden_by_idx" ON "blog_comments" ("hiddenBy");--> statement-breakpoint
CREATE INDEX "blog_comments_deleted_by_idx" ON "blog_comments" ("deletedBy");--> statement-breakpoint
CREATE INDEX "forum_comments_deleted_by_idx" ON "forum_comments" ("deletedBy");--> statement-breakpoint
CREATE INDEX "newsroom_comments_deleted_by_idx" ON "newsroom_comments" ("deletedBy");--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_hiddenBy_core_users_id_fkey" FOREIGN KEY ("hiddenBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_deletedBy_core_users_id_fkey" FOREIGN KEY ("deletedBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_author_core_users_id_fkey" FOREIGN KEY ("author") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_article_blog_posts_id_fkey" FOREIGN KEY ("article") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_parent_blog_comments_id_fkey" FOREIGN KEY ("parent") REFERENCES "blog_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_deletedBy_core_users_id_fkey" FOREIGN KEY ("deletedBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "newsroom_comments" ADD CONSTRAINT "newsroom_comments_deletedBy_core_users_id_fkey" FOREIGN KEY ("deletedBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;