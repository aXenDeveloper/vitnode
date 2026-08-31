CREATE TABLE "core_content_file_refs" (
	"id" serial PRIMARY KEY,
	"revisionId" integer NOT NULL,
	"fileId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_file_refs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "coverImage" integer;--> statement-breakpoint
ALTER TABLE "blog_posts_translations" ADD COLUMN "coverImageAlt" varchar(255);--> statement-breakpoint
ALTER TABLE "example_articles" ADD COLUMN "animation" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_file_refs_unique" ON "core_content_file_refs" ("revisionId","fileId");--> statement-breakpoint
CREATE INDEX "core_content_file_refs_file_id_idx" ON "core_content_file_refs" ("fileId");--> statement-breakpoint
CREATE INDEX "blog_posts_cover_image_idx" ON "blog_posts" ("coverImage");--> statement-breakpoint
CREATE INDEX "example_articles_animation_idx" ON "example_articles" ("animation");--> statement-breakpoint
ALTER TABLE "core_content_file_refs" ADD CONSTRAINT "core_content_file_refs_5get6SfhBPHr_fkey" FOREIGN KEY ("revisionId") REFERENCES "core_content_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "core_content_file_refs" ADD CONSTRAINT "core_content_file_refs_fileId_core_files_id_fkey" FOREIGN KEY ("fileId") REFERENCES "core_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_coverImage_core_files_id_fkey" FOREIGN KEY ("coverImage") REFERENCES "core_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "example_articles" ADD CONSTRAINT "example_articles_animation_core_files_id_fkey" FOREIGN KEY ("animation") REFERENCES "core_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;