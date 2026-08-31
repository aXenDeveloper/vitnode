-- Backfill the flat columns into core_languages_words (default language) before
-- dropping them, so rows created before titles/content moved to translations
-- keep their text. Guarded by NOT EXISTS so existing translations aren't duplicated.
INSERT INTO "core_languages_words" ("languageCode", "pluginCode", "itemId", "value", "tableName", "variable")
SELECT dl."code", '@vitnode/blog', c."id", c."title", 'blog_categories', 'title'
FROM "blog_categories" c
CROSS JOIN (SELECT "code" FROM "core_languages" WHERE "default" = true LIMIT 1) dl
WHERE c."title" <> '' AND NOT EXISTS (
  SELECT 1 FROM "core_languages_words" w
  WHERE w."pluginCode" = '@vitnode/blog' AND w."tableName" = 'blog_categories'
    AND w."variable" = 'title' AND w."itemId" = c."id"
);--> statement-breakpoint
INSERT INTO "core_languages_words" ("languageCode", "pluginCode", "itemId", "value", "tableName", "variable")
SELECT dl."code", '@vitnode/blog', p."id", p."title", 'blog_posts', 'title'
FROM "blog_posts" p
CROSS JOIN (SELECT "code" FROM "core_languages" WHERE "default" = true LIMIT 1) dl
WHERE p."title" <> '' AND NOT EXISTS (
  SELECT 1 FROM "core_languages_words" w
  WHERE w."pluginCode" = '@vitnode/blog' AND w."tableName" = 'blog_posts'
    AND w."variable" = 'title' AND w."itemId" = p."id"
);--> statement-breakpoint
INSERT INTO "core_languages_words" ("languageCode", "pluginCode", "itemId", "value", "tableName", "variable")
SELECT dl."code", '@vitnode/blog', p."id", p."content", 'blog_posts', 'content'
FROM "blog_posts" p
CROSS JOIN (SELECT "code" FROM "core_languages" WHERE "default" = true LIMIT 1) dl
WHERE p."content" <> '' AND NOT EXISTS (
  SELECT 1 FROM "core_languages_words" w
  WHERE w."pluginCode" = '@vitnode/blog' AND w."tableName" = 'blog_posts'
    AND w."variable" = 'content' AND w."itemId" = p."id"
);--> statement-breakpoint
ALTER TABLE "blog_categories" DROP CONSTRAINT "blog_categories_titleSeo_unique";--> statement-breakpoint
ALTER TABLE "blog_posts" DROP CONSTRAINT "blog_posts_titleSeo_unique";--> statement-breakpoint
ALTER TABLE "blog_categories" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "blog_categories" DROP COLUMN "titleSeo";--> statement-breakpoint
ALTER TABLE "blog_posts" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "blog_posts" DROP COLUMN "titleSeo";--> statement-breakpoint
ALTER TABLE "blog_posts" DROP COLUMN "content";
