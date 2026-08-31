CREATE TABLE "core_search_index" (
	"id" serial PRIMARY KEY NOT NULL,
	"pluginId" varchar(255) NOT NULL,
	"itemType" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"authorId" integer,
	"title" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"containerType" varchar(100),
	"containerId" integer,
	"url" text,
	"isPublic" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"indexedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_search_index_item_unique" UNIQUE("itemType","itemId")
);
--> statement-breakpoint
ALTER TABLE "core_search_index" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_search_index" ADD CONSTRAINT "core_search_index_authorId_core_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "core_search_index_created_at_idx" ON "core_search_index" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "core_search_index_author_id_idx" ON "core_search_index" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "core_search_index_item_type_idx" ON "core_search_index" USING btree ("itemType");--> statement-breakpoint
CREATE INDEX "core_search_index_is_public_idx" ON "core_search_index" USING btree ("isPublic");