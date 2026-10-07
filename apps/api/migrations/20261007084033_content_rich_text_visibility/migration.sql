ALTER TABLE "blog_posts" ADD COLUMN "hiddenAt" timestamp;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "hiddenBy" integer;--> statement-breakpoint
ALTER TABLE "blog_posts_translations" ADD COLUMN "contentText" text;--> statement-breakpoint
CREATE INDEX "blog_posts_hidden_by_idx" ON "blog_posts" ("hiddenBy");--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_hiddenBy_core_users_id_fkey" FOREIGN KEY ("hiddenBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
-- Backfill the plain-text search projection of the blog's rich text body for rows
-- written before it existed. An approximation of `stripHtml`; every later save
-- rewrites it with the exact extractor, and the search falls back to the HTML
-- column while it is NULL.
UPDATE "blog_posts_translations" SET "contentText" = btrim(regexp_replace(
  replace(replace(replace(replace(replace(replace(
    regexp_replace(
      regexp_replace(
        regexp_replace("content", '<(script|style|template|noscript|title|textarea|iframe)\M[^>]*>.*?</\1\s*>', ' ', 'gi'),
        '</?(p|div|h[1-6]|li|ul|ol|br|hr|tr|td|th|table|thead|tbody|tfoot|blockquote|pre|section|article|header|footer|figure|figcaption|caption|dd|dt|dl)\M[^>]*>', ' ', 'gi'),
      '<[^>]*>', '', 'g'),
  '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&amp;', '&'),
  '\s+', ' ', 'g'))
WHERE "content" IS NOT NULL AND "contentText" IS NULL;
