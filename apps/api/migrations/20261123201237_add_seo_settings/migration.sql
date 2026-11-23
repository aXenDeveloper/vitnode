CREATE TABLE "core_seo_settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"allowIndexing" boolean DEFAULT true NOT NULL,
	"blockAiCrawlers" boolean DEFAULT false NOT NULL,
	"customRobots" text DEFAULT '' NOT NULL,
	"sitemapEnabled" boolean DEFAULT true NOT NULL,
	"sitemapMaxUrls" integer DEFAULT 10000 NOT NULL,
	"disabledSitemapSources" jsonb DEFAULT '[]' NOT NULL,
	"updatedById" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_seo_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_seo_settings" ADD CONSTRAINT "core_seo_settings_updatedById_core_users_id_fkey" FOREIGN KEY ("updatedById") REFERENCES "core_users"("id") ON DELETE SET NULL;