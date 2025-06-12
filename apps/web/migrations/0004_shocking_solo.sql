ALTER TABLE "blog_categories" ALTER COLUMN "title" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "blog_categories" ADD COLUMN "titleSeo" varchar(100) DEFAULT '' NOT NULL;