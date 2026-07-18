-- Full-text search vector for content discovery. Title is weighted above body.
ALTER TABLE "core_search_index" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;
--> statement-breakpoint
CREATE INDEX "core_search_index_search_vector_idx" ON "core_search_index" USING gin ("search_vector");
