CREATE TABLE "example_articles_gallery" (
	"itemId" integer,
	"relatedItemId" integer,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "example_articles_gallery_pk" PRIMARY KEY("itemId","relatedItemId")
);
--> statement-breakpoint
ALTER TABLE "example_articles_gallery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "example_articles_gallery_position_key" ON "example_articles_gallery" ("itemId","position");--> statement-breakpoint
CREATE INDEX "example_articles_gallery_related_item_id_idx" ON "example_articles_gallery" ("relatedItemId");--> statement-breakpoint
ALTER TABLE "example_articles_gallery" ADD CONSTRAINT "example_articles_gallery_itemId_example_articles_id_fkey" FOREIGN KEY ("itemId") REFERENCES "example_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "example_articles_gallery" ADD CONSTRAINT "example_articles_gallery_relatedItemId_core_files_id_fkey" FOREIGN KEY ("relatedItemId") REFERENCES "core_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;