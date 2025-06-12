CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"titleSeo" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"categoryId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "blog_posts_titleSeo_unique" UNIQUE("titleSeo")
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_blog_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."blog_categories"("id") ON DELETE no action ON UPDATE no action;