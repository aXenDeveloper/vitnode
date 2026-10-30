CREATE TABLE "core_audit_logs" (
	"id" bigserial PRIMARY KEY,
	"pluginId" varchar(255) NOT NULL,
	"area" varchar(16) NOT NULL,
	"action" varchar(150) NOT NULL,
	"actorType" varchar(16) NOT NULL,
	"actorId" integer,
	"actorName" varchar(255),
	"targetType" varchar(100) NOT NULL,
	"targetId" varchar(64),
	"targetLabel" varchar(255),
	"changes" jsonb,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"contentTypeId" varchar(100),
	"revisionId" integer,
	"scopeFamily" varchar(100),
	"scopeId" varchar(64),
	"ipAddress" varchar(45),
	"correlationId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_audit_settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"retentionDays" integer DEFAULT 365 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_audit_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_audit_logs_created_at_id_idx" ON "core_audit_logs" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_audit_logs_actor_idx" ON "core_audit_logs" ("actorId","createdAt");--> statement-breakpoint
CREATE INDEX "core_audit_logs_plugin_idx" ON "core_audit_logs" ("pluginId","createdAt");--> statement-breakpoint
CREATE INDEX "core_audit_logs_action_idx" ON "core_audit_logs" ("action","createdAt");--> statement-breakpoint
CREATE INDEX "core_audit_logs_area_idx" ON "core_audit_logs" ("area","createdAt");--> statement-breakpoint
CREATE INDEX "core_audit_logs_target_idx" ON "core_audit_logs" ("pluginId","targetType","targetId","createdAt");--> statement-breakpoint
CREATE INDEX "core_audit_logs_scope_idx" ON "core_audit_logs" ("scopeFamily","scopeId","createdAt");--> statement-breakpoint
ALTER TABLE "core_audit_logs" ADD CONSTRAINT "core_audit_logs_actorId_core_users_id_fkey" FOREIGN KEY ("actorId") REFERENCES "core_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;