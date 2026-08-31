CREATE TABLE "example_advanced_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"syndicationIndexable" boolean DEFAULT true NOT NULL,
	"syndicationPriority" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_advanced_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "example_advanced_articles_categories" (
	"itemId" integer NOT NULL,
	"relatedItemId" integer NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "example_advanced_articles_categories_pk" PRIMARY KEY("itemId","relatedItemId")
);
--> statement-breakpoint
ALTER TABLE "example_advanced_articles_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "example_advanced_articles_faq" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemId" integer NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"question" varchar(200) NOT NULL,
	"answer" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_advanced_articles_faq" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "example_advanced_articles_related_articles" (
	"itemId" integer NOT NULL,
	"relatedItemId" integer NOT NULL,
	"position" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "example_advanced_articles_related_articles_pk" PRIMARY KEY("itemId","relatedItemId")
);
--> statement-breakpoint
ALTER TABLE "example_advanced_articles_related_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "example_advanced_articles_translations" (
	"itemId" integer NOT NULL,
	"languageId" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publishedAt" timestamp,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"seoTitle" varchar(200),
	"seoDescription" text,
	CONSTRAINT "example_advanced_articles_translations_item_id_language_id_pk" PRIMARY KEY("itemId","languageId")
);
--> statement-breakpoint
ALTER TABLE "example_advanced_articles_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_categories" ADD CONSTRAINT "example_advanced_articles_categories_itemId_example_advanced_articles_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."example_advanced_articles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_categories" ADD CONSTRAINT "example_advanced_articles_categories_relatedItemId_example_categories_id_fk" FOREIGN KEY ("relatedItemId") REFERENCES "public"."example_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_faq" ADD CONSTRAINT "example_advanced_articles_faq_itemId_example_advanced_articles_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."example_advanced_articles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_related_articles" ADD CONSTRAINT "example_advanced_articles_related_articles_itemId_example_advanced_articles_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."example_advanced_articles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_related_articles" ADD CONSTRAINT "example_advanced_articles_related_articles_relatedItemId_example_advanced_articles_id_fk" FOREIGN KEY ("relatedItemId") REFERENCES "public"."example_advanced_articles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_translations" ADD CONSTRAINT "example_advanced_articles_translations_itemId_example_advanced_articles_id_fk" FOREIGN KEY ("itemId") REFERENCES "public"."example_advanced_articles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_advanced_articles_translations" ADD CONSTRAINT "example_advanced_articles_translations_languageId_core_languages_id_fk" FOREIGN KEY ("languageId") REFERENCES "public"."core_languages"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "example_advanced_articles_syndication_priority_idx" ON "example_advanced_articles" USING btree ("syndicationPriority");--> statement-breakpoint
CREATE INDEX "example_advanced_articles_created_at_idx" ON "example_advanced_articles" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "example_advanced_articles_updated_at_idx" ON "example_advanced_articles" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "example_advanced_articles_status_published_at_idx" ON "example_advanced_articles" USING btree ("status","publishedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "example_advanced_articles_categories_position_key" ON "example_advanced_articles_categories" USING btree ("itemId","position");--> statement-breakpoint
CREATE INDEX "example_advanced_articles_categories_related_item_id_idx" ON "example_advanced_articles_categories" USING btree ("relatedItemId");--> statement-breakpoint
CREATE UNIQUE INDEX "example_advanced_articles_faq_position_key" ON "example_advanced_articles_faq" USING btree ("itemId","position");--> statement-breakpoint
CREATE UNIQUE INDEX "example_advanced_articles_related_articles_position_key" ON "example_advanced_articles_related_articles" USING btree ("itemId","position");--> statement-breakpoint
CREATE INDEX "example_advanced_articles_related_articles_related_item_id_idx" ON "example_advanced_articles_related_articles" USING btree ("relatedItemId");--> statement-breakpoint
CREATE INDEX "example_advanced_articles_translations_language_id_status_idx" ON "example_advanced_articles_translations" USING btree ("languageId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "example_advanced_articles_translations_language_id_slug_key" ON "example_advanced_articles_translations" USING btree ("languageId","slug");