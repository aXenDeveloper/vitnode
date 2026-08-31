CREATE TABLE "example_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"title" varchar(200) NOT NULL,
	"code" varchar(100) NOT NULL,
	"excerpt" text,
	"views" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"status" varchar(64) DEFAULT 'draft' NOT NULL,
	"publishedAt" timestamp,
	"author" integer,
	"category" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "example_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "example_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "example_articles" ADD CONSTRAINT "example_articles_author_core_users_id_fk" FOREIGN KEY ("author") REFERENCES "public"."core_users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "example_articles" ADD CONSTRAINT "example_articles_category_example_categories_id_fk" FOREIGN KEY ("category") REFERENCES "public"."example_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "example_articles_status_created_at_idx" ON "example_articles" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "example_articles_code_key" ON "example_articles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "example_articles_author_idx" ON "example_articles" USING btree ("author");--> statement-breakpoint
CREATE INDEX "example_articles_category_idx" ON "example_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "example_articles_created_at_idx" ON "example_articles" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "example_articles_updated_at_idx" ON "example_articles" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "example_categories_created_at_idx" ON "example_categories" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "example_categories_updated_at_idx" ON "example_categories" USING btree ("updatedAt");