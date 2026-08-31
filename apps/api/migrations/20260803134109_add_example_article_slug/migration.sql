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
-- Every row gets its id appended - not just the ambiguous ones.
--
-- Suffixing only duplicates looks tidier and is wrong: the rescue value is
-- itself a slug, so it can land on a natural one that was left alone. Titles
-- "Foo 2", "Foo", "Foo" normalise to "foo-2", "foo", "foo"; rescuing only the
-- pair produces "foo-2" and "foo-3", and the first of those is already taken by
-- row 1. The same trap catches a title that normalises to nothing and falls
-- back to its id, against a row whose title genuinely normalised to that
-- number. Both only surface as a failure two statements later, when the unique
-- index is created.
--
-- Appending the id everywhere makes a collision impossible rather than
-- unlikely: every value ends in `-<id>`, or is `<id>` when the title left
-- nothing behind, and ids are unique. Two results can only be equal if their
-- ids are, so there is nothing left to check.
--
-- The base is truncated *first*, to leave exactly enough room for "-" and the
-- id: a 160-character slug plus a suffix would overflow varchar(160). The trim
-- runs after the truncation, so cutting mid-word cannot leave a trailing dash.
-- `NULLIF` + `concat_ws` drop an empty base entirely, so a row with no usable
-- title becomes just its id rather than "-12".
--
-- This is backfill behaviour, and it stops here. A slug chosen at runtime is
-- never silently suffixed; a collision there is a 409.
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
);--> statement-breakpoint
ALTER TABLE "example_articles" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "example_articles_slug_key" ON "example_articles" USING btree ("slug");
