CREATE TABLE "blog_categories_translations" (
	"itemId" integer NOT NULL,
	"languageId" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "blog_categories_translations_item_id_language_id_pk" PRIMARY KEY("itemId","languageId")
);
--> statement-breakpoint
ALTER TABLE "blog_categories_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_posts_translations" (
	"itemId" integer NOT NULL,
	"languageId" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"title" varchar(255) NOT NULL,
	"friendlyUrl" varchar(255) NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "blog_posts_translations_item_id_language_id_pk" PRIMARY KEY("itemId","languageId")
);
--> statement-breakpoint
ALTER TABLE "blog_posts_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_categoryId_blog_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "blog_categories" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "blog_posts" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "publishedAt" timestamp;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "status" varchar(32) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_categories_translations" ADD CONSTRAINT "blog_categories_translations_itemId_blog_categories_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blog_categories_translations" ADD CONSTRAINT "blog_categories_translations_languageId_core_languages_id_fk" FOREIGN KEY ("languageId") REFERENCES "public"."core_languages"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blog_posts_translations" ADD CONSTRAINT "blog_posts_translations_itemId_blog_posts_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "blog_posts_translations" ADD CONSTRAINT "blog_posts_translations_languageId_core_languages_id_fk" FOREIGN KEY ("languageId") REFERENCES "public"."core_languages"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "blog_categories_translations_language_id_idx" ON "blog_categories_translations" USING btree ("languageId");--> statement-breakpoint
CREATE INDEX "blog_posts_translations_language_id_status_idx" ON "blog_posts_translations" USING btree ("languageId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_translations_language_id_friendly_url_key" ON "blog_posts_translations" USING btree ("languageId","friendlyUrl");--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_blog_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."blog_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "blog_categories_created_at_idx" ON "blog_categories" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "blog_categories_updated_at_idx" ON "blog_categories" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "blog_posts_status_created_at_idx" ON "blog_posts" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts" USING btree ("status","publishedAt");--> statement-breakpoint
--
-- Data migration: the blog's own storage -> the Content Engine's.
--
-- Nothing above this line dropped a table or a column, and nothing below moves a
-- record: ids, categories, authors and timestamps stay exactly where they are.
-- What moves is the *text*, out of `core_languages_words` and into the two
-- translation tables the engine reads.
--

-- 1. Publication. Every article that exists today is publicly readable - the old
--    public route returned every row and every search document was written
--    `isPublic: true` - so they all migrate as published. `publishedAt` is
--    `createdAt`, which is the only publication date the old schema can prove;
--    no revision history is fabricated, so `version` stays at its default of 1.
UPDATE "blog_posts"
SET "status" = 'published', "publishedAt" = "createdAt"
WHERE "status" = 'draft' AND "publishedAt" IS NULL;--> statement-breakpoint

-- 2. Category names. One row per (category, language) that actually had a title,
--    so a language nobody translated into stays untranslated rather than being
--    invented. A stored empty title would break `name`'s minimum length, so it
--    falls back to a unique placeholder an editor can see and fix.
INSERT INTO "blog_categories_translations"
  ("itemId", "languageId", "version", "createdAt", "updatedAt", "name")
SELECT
  c."id",
  l."id",
  1,
  c."createdAt",
  c."updatedAt",
  LEFT(COALESCE(NULLIF(w."value", ''), 'category-' || c."id"), 100)
FROM "core_languages_words" w
JOIN "blog_categories" c ON c."id" = w."itemId"
JOIN "core_languages" l ON l."code" = w."languageCode"
WHERE w."pluginCode" = '@vitnode/blog'
  AND w."tableName" = 'blog_categories'
  AND w."variable" = 'title'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 3. Article text. The three variables the plugin kept side by side become one
--    row, for each (article, language) pair that had any of them. A missing
--    friendly URL falls back to something unique rather than to an empty string,
--    which the new UNIQUE (languageId, friendlyUrl) index would reject on the
--    second article.
INSERT INTO "blog_posts_translations" (
  "itemId", "languageId", "version", "createdAt", "updatedAt",
  "publishedAt", "status", "title", "friendlyUrl", "content"
)
SELECT
  p."id",
  l."id",
  1,
  p."createdAt",
  p."updatedAt",
  p."createdAt",
  'published',
  LEFT(COALESCE(w."title", ''), 255),
  LEFT(
    COALESCE(NULLIF(w."friendlyUrl", ''), 'post-' || p."id" || '-' || l."code"),
    255
  ),
  COALESCE(w."content", '')
FROM (
  SELECT
    "itemId",
    "languageCode",
    MAX("value") FILTER (WHERE "variable" = 'title') AS "title",
    MAX("value") FILTER (WHERE "variable" = 'content') AS "content",
    MAX("value") FILTER (WHERE "variable" = 'friendlyUrl') AS "friendlyUrl"
  FROM "core_languages_words"
  WHERE "pluginCode" = '@vitnode/blog'
    AND "tableName" = 'blog_posts'
    AND "variable" IN ('title', 'content', 'friendlyUrl')
  GROUP BY "itemId", "languageCode"
) w
JOIN "blog_posts" p ON p."id" = w."itemId"
JOIN "core_languages" l ON l."code" = w."languageCode"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 4. The default locale. A localized content type refuses to leave a record
--    without a translation in its `defaultLocale`, so a record that was only ever
--    written in another language gets an English row built from the name it
--    already has in whichever language it does have. Nothing is invented: the
--    value is one the record genuinely carries.
INSERT INTO "blog_categories_translations"
  ("itemId", "languageId", "version", "createdAt", "updatedAt", "name")
SELECT
  c."id",
  l."id",
  1,
  c."createdAt",
  c."updatedAt",
  LEFT(
    COALESCE(
      (
        SELECT NULLIF(t."name", '')
        FROM "blog_categories_translations" t
        WHERE t."itemId" = c."id"
        ORDER BY t."languageId"
        LIMIT 1
      ),
      'category-' || c."id"
    ),
    100
  )
FROM "blog_categories" c
JOIN "core_languages" l ON l."code" = 'en'
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "blog_posts_translations" (
  "itemId", "languageId", "version", "createdAt", "updatedAt",
  "publishedAt", "status", "title", "friendlyUrl", "content"
)
SELECT
  p."id",
  l."id",
  1,
  p."createdAt",
  p."updatedAt",
  p."createdAt",
  'published',
  LEFT(COALESCE(NULLIF(source."title", ''), 'post-' || p."id"), 255),
  LEFT('post-' || p."id" || '-en', 255),
  COALESCE(source."content", '')
FROM "blog_posts" p
JOIN "core_languages" l ON l."code" = 'en'
LEFT JOIN LATERAL (
  SELECT t."title", t."content"
  FROM "blog_posts_translations" t
  WHERE t."itemId" = p."id"
  ORDER BY t."languageId"
  LIMIT 1
) source ON TRUE
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 5. The old storage, now that everything in it has a new home. Scoped to rows
--    that were genuinely migrated: a word in a language the install does not have
--    could not be copied, so it is left where it is rather than deleted.
DELETE FROM "core_languages_words" w
USING "core_languages" l
WHERE w."pluginCode" = '@vitnode/blog'
  AND w."tableName" IN ('blog_categories', 'blog_posts')
  AND l."code" = w."languageCode";
