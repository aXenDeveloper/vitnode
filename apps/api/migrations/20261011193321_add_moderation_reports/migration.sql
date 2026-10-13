CREATE TABLE "core_moderation_report_events" (
	"id" serial PRIMARY KEY,
	"reportId" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"actorId" integer,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_moderation_report_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_moderation_reports" (
	"id" serial PRIMARY KEY,
	"pluginId" varchar(100) NOT NULL,
	"targetType" varchar(100) NOT NULL,
	"targetId" varchar(64) NOT NULL,
	"reporterId" integer,
	"reason" varchar(32) NOT NULL,
	"description" text,
	"snapshot" jsonb NOT NULL,
	"targetTitle" varchar(500),
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"assigneeId" integer,
	"resolution" varchar(32),
	"resolutionNote" text,
	"resolvedAt" timestamp,
	"resolvedById" integer,
	"scopeFamily" varchar(100),
	"scopeId" varchar(64),
	"openKey" varchar(255) UNIQUE,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_moderation_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_moderation_report_events_report_idx" ON "core_moderation_report_events" ("reportId","id");--> statement-breakpoint
CREATE INDEX "core_moderation_reports_target_idx" ON "core_moderation_reports" ("pluginId","targetType","targetId");--> statement-breakpoint
CREATE INDEX "core_moderation_reports_status_idx" ON "core_moderation_reports" ("status","createdAt");--> statement-breakpoint
CREATE INDEX "core_moderation_reports_assignee_idx" ON "core_moderation_reports" ("assigneeId");--> statement-breakpoint
CREATE INDEX "core_moderation_reports_reporter_idx" ON "core_moderation_reports" ("reporterId","createdAt");--> statement-breakpoint
CREATE INDEX "core_moderation_reports_scope_idx" ON "core_moderation_reports" ("scopeFamily","scopeId");--> statement-breakpoint
ALTER TABLE "core_moderation_report_events" ADD CONSTRAINT "core_moderation_report_events_4CqHOxfheaUm_fkey" FOREIGN KEY ("reportId") REFERENCES "core_moderation_reports"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_moderation_report_events" ADD CONSTRAINT "core_moderation_report_events_actorId_core_users_id_fkey" FOREIGN KEY ("actorId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_reports" ADD CONSTRAINT "core_moderation_reports_reporterId_core_users_id_fkey" FOREIGN KEY ("reporterId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_reports" ADD CONSTRAINT "core_moderation_reports_assigneeId_core_users_id_fkey" FOREIGN KEY ("assigneeId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_reports" ADD CONSTRAINT "core_moderation_reports_resolvedById_core_users_id_fkey" FOREIGN KEY ("resolvedById") REFERENCES "core_users"("id") ON DELETE SET NULL;