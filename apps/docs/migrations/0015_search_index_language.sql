ALTER TABLE "core_search_index" DROP CONSTRAINT "core_search_index_item_unique";--> statement-breakpoint
ALTER TABLE "core_search_index" ADD COLUMN "languageCode" varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "core_search_index_language_code_idx" ON "core_search_index" USING btree ("languageCode");--> statement-breakpoint
ALTER TABLE "core_search_index" ADD CONSTRAINT "core_search_index_item_unique" UNIQUE("itemType","itemId","languageCode");