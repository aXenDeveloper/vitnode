CREATE TABLE "core_search_popularity" (
	"itemType" varchar(100),
	"itemId" varchar(64),
	"logScore" double precision NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_search_popularity_pkey" PRIMARY KEY("itemType","itemId")
);
--> statement-breakpoint
ALTER TABLE "core_search_popularity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_search_popularity_log_score_idx" ON "core_search_popularity" ("logScore");