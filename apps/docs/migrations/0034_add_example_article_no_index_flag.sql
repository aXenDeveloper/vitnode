-- `example.article` gained `field.boolean({ nullable: true })` as its Stage 8
-- `delivery.seo.noIndexField`.
--
-- Nullable and undefaulted on purpose, because that is what an upgrade really
-- looks like: every row that already exists gets `NULL`, and `NULL` has to mean
-- "index me" in both places that read it - the `robots` metadata rendered into
-- the page and the predicate that decides what the sitemap lists. A boolean
-- added with `DEFAULT false NOT NULL` would rewrite the table and hide the case
-- worth testing.
ALTER TABLE "example_articles" ADD COLUMN "noIndex" boolean;
