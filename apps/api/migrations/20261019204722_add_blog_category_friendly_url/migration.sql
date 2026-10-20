ALTER TABLE "blog_categories_translations" ADD COLUMN "friendlyUrl" varchar(255);--> statement-breakpoint
UPDATE "blog_categories_translations"
SET "friendlyUrl" = NULLIF(
  trim(both '-' from regexp_replace(lower(left("name", 255)), '[^a-z0-9]+', '-', 'g')),
  ''
);--> statement-breakpoint
UPDATE "blog_categories_translations" AS t
SET "friendlyUrl" = concat_ws(
  '-',
  NULLIF(
    trim(
      both '-' from
      left(coalesce(t."friendlyUrl", ''), 255 - 1 - length(t."itemId"::text))
    ),
    ''
  ),
  t."itemId"
);--> statement-breakpoint
ALTER TABLE "blog_categories_translations" ALTER COLUMN "friendlyUrl" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_translations_language_id_friendly_url_key" ON "blog_categories_translations" ("languageId","friendlyUrl");
