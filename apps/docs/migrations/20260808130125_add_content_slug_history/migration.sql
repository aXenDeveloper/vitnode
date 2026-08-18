CREATE TABLE "core_content_slug_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"pluginId" varchar(255) NOT NULL,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"languageId" integer,
	"slug" varchar(160) NOT NULL,
	"path" varchar(512) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"retiredAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_content_slug_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_slug_history_shared_unique" ON "core_content_slug_history" USING btree ("contentTypeId","slug") WHERE "languageId" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_slug_history_locale_unique" ON "core_content_slug_history" USING btree ("contentTypeId","languageId","slug") WHERE "languageId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_content_slug_history_item_idx" ON "core_content_slug_history" USING btree ("contentTypeId","itemId","languageId");--> statement-breakpoint
CREATE INDEX "core_content_slug_history_plugin_id_idx" ON "core_content_slug_history" USING btree ("pluginId");