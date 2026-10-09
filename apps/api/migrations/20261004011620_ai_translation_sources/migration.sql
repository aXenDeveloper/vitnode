CREATE TABLE "core_ai_translation_sources" (
	"id" serial PRIMARY KEY,
	"contentTypeId" varchar(255) NOT NULL,
	"itemId" integer NOT NULL,
	"locale" varchar(32) NOT NULL,
	"field" varchar(255) NOT NULL,
	"sourceLocale" varchar(32) NOT NULL,
	"sourceFingerprint" varchar(64) NOT NULL,
	"targetFingerprint" varchar(64) NOT NULL,
	"origin" varchar(10) NOT NULL,
	"updatedById" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_translation_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_translation_sources_unique" ON "core_ai_translation_sources" ("contentTypeId","itemId","locale","field");--> statement-breakpoint
ALTER TABLE "core_ai_translation_sources" ADD CONSTRAINT "core_ai_translation_sources_updatedById_core_users_id_fkey" FOREIGN KEY ("updatedById") REFERENCES "core_users"("id") ON DELETE SET NULL;