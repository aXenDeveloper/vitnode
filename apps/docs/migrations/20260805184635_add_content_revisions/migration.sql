CREATE TABLE "core_content_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pluginId" varchar(255) NOT NULL,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"version" integer NOT NULL,
	"operation" varchar(20) NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"changedFields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actorType" varchar(16) DEFAULT 'system' NOT NULL,
	"actorUserId" integer,
	"restoredFromRevisionId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_content_revisions" ADD CONSTRAINT "core_content_revisions_actorUserId_core_users_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_revisions_item_version_unique" ON "core_content_revisions" USING btree ("contentTypeId","itemId","version");--> statement-breakpoint
CREATE INDEX "core_content_revisions_plugin_id_idx" ON "core_content_revisions" USING btree ("pluginId");--> statement-breakpoint
CREATE INDEX "core_content_revisions_actor_user_id_idx" ON "core_content_revisions" USING btree ("actorUserId");