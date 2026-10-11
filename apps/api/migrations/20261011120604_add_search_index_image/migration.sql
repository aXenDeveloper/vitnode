ALTER TABLE "core_search_index" ADD COLUMN "imageId" integer;--> statement-breakpoint
CREATE INDEX "core_search_index_image_id_idx" ON "core_search_index" ("imageId");--> statement-breakpoint
ALTER TABLE "core_search_index" ADD CONSTRAINT "core_search_index_imageId_core_files_id_fkey" FOREIGN KEY ("imageId") REFERENCES "core_files"("id") ON DELETE SET NULL;