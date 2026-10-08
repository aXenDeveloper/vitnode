CREATE TABLE "core_content_documents" (
	"id" serial PRIMARY KEY,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"field" varchar(100) NOT NULL,
	"language" varchar(35) DEFAULT '' NOT NULL,
	"state" bytea NOT NULL,
	"baseVersion" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" integer
);
--> statement-breakpoint
ALTER TABLE "core_content_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_content_drafts" (
	"id" serial PRIMARY KEY,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"language" varchar(32) DEFAULT '' NOT NULL,
	"values" jsonb DEFAULT '{}' NOT NULL,
	"baseVersion" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" integer
);
--> statement-breakpoint
ALTER TABLE "core_content_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_content_field_locks" (
	"id" serial PRIMARY KEY,
	"contentTypeId" varchar(100) NOT NULL,
	"itemId" integer NOT NULL,
	"field" varchar(100) NOT NULL,
	"language" varchar(32) DEFAULT '' NOT NULL,
	"userId" integer NOT NULL,
	"acquiredAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_field_locks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_posts_translations" ALTER COLUMN "content" SET DATA TYPE jsonb USING (
  CASE
    WHEN "content" IS NULL THEN NULL
    WHEN btrim(regexp_replace("content", '<[^>]*>', ' ', 'g')) = '' THEN '{"type":"doc","content":[]}'::jsonb
    ELSE jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object(
          'type', 'text',
          'text', btrim(regexp_replace(regexp_replace("content", '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g'))
        ))
      ))
    )
  END
);--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_documents_doc_unique" ON "core_content_documents" ("contentTypeId","itemId","field","language");--> statement-breakpoint
CREATE INDEX "core_content_documents_updated_at_idx" ON "core_content_documents" ("updatedAt");--> statement-breakpoint
CREATE INDEX "core_content_documents_updated_by_idx" ON "core_content_documents" ("updatedBy");--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_drafts_key_unique" ON "core_content_drafts" ("contentTypeId","itemId","language");--> statement-breakpoint
CREATE INDEX "core_content_drafts_updated_at_idx" ON "core_content_drafts" ("updatedAt");--> statement-breakpoint
CREATE INDEX "core_content_drafts_updated_by_idx" ON "core_content_drafts" ("updatedBy");--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_field_locks_key_unique" ON "core_content_field_locks" ("contentTypeId","itemId","field","language");--> statement-breakpoint
CREATE INDEX "core_content_field_locks_expires_at_idx" ON "core_content_field_locks" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_content_field_locks_user_id_idx" ON "core_content_field_locks" ("userId");--> statement-breakpoint
ALTER TABLE "core_content_documents" ADD CONSTRAINT "core_content_documents_updatedBy_core_users_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "core_content_drafts" ADD CONSTRAINT "core_content_drafts_updatedBy_core_users_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "core_content_field_locks" ADD CONSTRAINT "core_content_field_locks_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;