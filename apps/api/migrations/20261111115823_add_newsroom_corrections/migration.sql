CREATE TABLE "newsroom_corrections" (
	"id" serial PRIMARY KEY,
	"articleId" integer NOT NULL,
	"body" varchar(1000) NOT NULL,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "newsroom_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "newsroom_corrections_article_id_idx" ON "newsroom_corrections" ("articleId");--> statement-breakpoint
ALTER TABLE "newsroom_corrections" ADD CONSTRAINT "newsroom_corrections_articleId_newsroom_articles_id_fkey" FOREIGN KEY ("articleId") REFERENCES "newsroom_articles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "newsroom_corrections" ADD CONSTRAINT "newsroom_corrections_createdById_core_users_id_fkey" FOREIGN KEY ("createdById") REFERENCES "core_users"("id") ON DELETE SET NULL;