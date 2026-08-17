CREATE TABLE "blog_posts_author_id" (
	"itemId" integer NOT NULL,
	"relatedItemId" integer NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_author_id_pk" PRIMARY KEY("itemId","relatedItemId")
);
--> statement-breakpoint
ALTER TABLE "blog_posts_author_id" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_posts_category_id" (
	"itemId" integer NOT NULL,
	"relatedItemId" integer NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_category_id_pk" PRIMARY KEY("itemId","relatedItemId")
);
--> statement-breakpoint
ALTER TABLE "blog_posts_category_id" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_categoryId_blog_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_authorId_core_users_id_fk";
--> statement-breakpoint
DROP INDEX "blog_posts_category_id_idx";--> statement-breakpoint
DROP INDEX "blog_posts_author_id_idx";--> statement-breakpoint
ALTER TABLE "blog_posts_author_id" ADD CONSTRAINT "blog_posts_author_id_itemId_blog_posts_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blog_posts_author_id" ADD CONSTRAINT "blog_posts_author_id_relatedItemId_core_users_id_fk" FOREIGN KEY ("relatedItemId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blog_posts_category_id" ADD CONSTRAINT "blog_posts_category_id_itemId_blog_posts_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blog_posts_category_id" ADD CONSTRAINT "blog_posts_category_id_relatedItemId_blog_categories_id_fk" FOREIGN KEY ("relatedItemId") REFERENCES "public"."blog_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_author_id_position_key" ON "blog_posts_author_id" USING btree ("itemId","position");--> statement-breakpoint
CREATE INDEX "blog_posts_author_id_related_item_id_idx" ON "blog_posts_author_id" USING btree ("relatedItemId");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_category_id_position_key" ON "blog_posts_category_id" USING btree ("itemId","position");--> statement-breakpoint
CREATE INDEX "blog_posts_category_id_related_item_id_idx" ON "blog_posts_category_id" USING btree ("relatedItemId");--> statement-breakpoint
--
-- Data migration: one category and one author per article -> a set of each.
--
-- Everything above created the junction tables; everything below fills them
-- from the columns that are about to be dropped. Backfill *then* drop, in one
-- transaction, so there is no moment where an article's category exists in
-- neither place.
--
-- `position` is 0 for every row, which is exactly right for a set of one: the
-- engine's unique `(itemId, position)` is satisfied, an unordered field (the
-- categories) reads back in id order anyway, and an ordered one (the authors)
-- opens with its single author first.
--

-- 1. Categories. `NOT NULL` on the old column, so every article has exactly one
--    and every article ends up with exactly one membership.
INSERT INTO "blog_posts_category_id" ("itemId", "relatedItemId", "position", "createdAt")
SELECT "id", "categoryId", 0, "createdAt" FROM "blog_posts";--> statement-breakpoint

-- 2. Authors. Nullable on the old column - an article whose author was deleted
--    had `NULL` there and gets no membership, which is the same fact stored the
--    new way: the empty set is what "nobody" looks like.
INSERT INTO "blog_posts_author_id" ("itemId", "relatedItemId", "position", "createdAt")
SELECT "id", "authorId", 0, "createdAt" FROM "blog_posts" WHERE "authorId" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "blog_posts" DROP COLUMN "categoryId";--> statement-breakpoint
ALTER TABLE "blog_posts" DROP COLUMN "authorId";