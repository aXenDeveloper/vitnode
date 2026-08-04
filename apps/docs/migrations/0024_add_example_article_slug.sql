-- `example.article` gained `field.slug({ source: "title" })`.
--
-- Drizzle Kit generates this as a single `ADD COLUMN "slug" varchar(160) NOT
-- NULL`, which fails on a populated table: there is no default to backfill the
-- existing rows with. So the column arrives nullable, gets a value derived from
-- the title, and only then becomes NOT NULL and unique. That is the recipe for
-- every slug added to a table that already has data.
ALTER TABLE "example_articles" ADD COLUMN "slug" varchar(160);--> statement-breakpoint
-- The same normalisation `slugify` performs, in the subset of it SQL can do
-- without an extension: lowercase, non-alphanumerics to dashes, trimmed.
-- Accented characters simply drop out here rather than transliterating, which
-- is why the next statement exists.
UPDATE "example_articles"
SET "slug" = NULLIF(
  trim(both '-' from regexp_replace(lower(left("title", 160)), '[^a-z0-9]+', '-', 'g')),
  ''
);--> statement-breakpoint
-- Two rows can share a title, and a title in a non-Latin script normalises to
-- nothing at all. Both keep their row id as a deterministic tie-breaker - no
-- title is overwritten and no row is dropped.
--
-- The base is truncated *first*, to leave exactly enough room for "-" and the
-- id: a 160-character slug plus a suffix would overflow varchar(160) and fail
-- the migration on precisely the rows this statement exists to rescue. The
-- second trim runs after truncation, so cutting mid-word cannot leave a
-- trailing dash. `NULLIF` + `concat_ws` then drop an empty base entirely, so a
-- row with no usable title becomes just its id rather than "-12".
UPDATE "example_articles" AS a
SET "slug" = concat_ws(
  '-',
  NULLIF(
    trim(
      both '-' from
      left(coalesce(a."slug", ''), 160 - 1 - length(a."id"::text))
    ),
    ''
  ),
  a."id"
)
WHERE a."slug" IS NULL
   OR EXISTS (
     SELECT 1 FROM "example_articles" AS b
     WHERE b."slug" = a."slug" AND b."id" <> a."id"
   );--> statement-breakpoint
ALTER TABLE "example_articles" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "example_articles_slug_key" ON "example_articles" USING btree ("slug");
