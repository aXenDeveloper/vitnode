CREATE TABLE "core_moderation_report_reasons" (
	"id" serial PRIMARY KEY,
	"code" varchar(32) NOT NULL UNIQUE,
	"requiresDetails" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_moderation_report_reasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_moderation_report_reasons_position_idx" ON "core_moderation_report_reasons" ("position");