CREATE TABLE "example_localized_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_localized_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "example_localized_articles_translations" (
	"itemId" integer NOT NULL,
	"languageId" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"body" text NOT NULL,
	CONSTRAINT "example_localized_articles_translations_item_id_language_id_pk" PRIMARY KEY("itemId","languageId")
);
--> statement-breakpoint
ALTER TABLE "example_localized_articles_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "example_localized_articles_translations" ADD CONSTRAINT "example_localized_articles_translations_itemId_example_localized_articles_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."example_localized_articles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_localized_articles_translations" ADD CONSTRAINT "example_localized_articles_translations_languageId_core_languages_id_fk" FOREIGN KEY ("languageId") REFERENCES "public"."core_languages"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "example_localized_articles_created_at_idx" ON "example_localized_articles" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "example_localized_articles_updated_at_idx" ON "example_localized_articles" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "example_localized_articles_translations_language_id_idx" ON "example_localized_articles_translations" USING btree ("languageId");--> statement-breakpoint
CREATE UNIQUE INDEX "example_localized_articles_translations_language_id_slug_key" ON "example_localized_articles_translations" USING btree ("languageId","slug");