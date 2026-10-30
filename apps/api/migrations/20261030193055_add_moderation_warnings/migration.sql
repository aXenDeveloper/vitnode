CREATE TABLE "core_moderation_sanctions" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"startsAt" timestamp DEFAULT now() NOT NULL,
	"endsAt" timestamp,
	"warningId" integer UNIQUE,
	"thresholdId" integer,
	"thresholdSnapshot" jsonb,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp,
	"revokedById" integer,
	"revokeReason" text
);
--> statement-breakpoint
ALTER TABLE "core_moderation_sanctions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_moderation_warning_reasons" (
	"id" serial PRIMARY KEY,
	"points" integer DEFAULT 0 NOT NULL,
	"expiresAfterHours" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_moderation_warning_reasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_moderation_warning_thresholds" (
	"id" serial PRIMARY KEY,
	"points" integer NOT NULL,
	"action" varchar(32) NOT NULL,
	"durationHours" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_moderation_warning_thresholds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_moderation_warnings" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"issuedById" integer,
	"reasonId" integer,
	"reasonSnapshot" jsonb,
	"points" integer NOT NULL,
	"defaultPoints" integer,
	"overrideNote" text,
	"message" text NOT NULL,
	"staffNote" text,
	"issuedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"pointsBefore" integer DEFAULT 0 NOT NULL,
	"pointsAfter" integer DEFAULT 0 NOT NULL,
	"pluginId" varchar(100),
	"targetType" varchar(100),
	"targetId" varchar(64),
	"scopeFamily" varchar(100),
	"scopeId" varchar(64),
	"contentSnapshot" jsonb,
	"reportId" integer,
	"idempotencyKey" varchar(64),
	"revokedAt" timestamp,
	"revokedById" integer,
	"revokeReason" text,
	CONSTRAINT "core_moderation_warnings_idempotency_key" UNIQUE("issuedById","idempotencyKey")
);
--> statement-breakpoint
ALTER TABLE "core_moderation_warnings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_moderation_sanctions_user_idx" ON "core_moderation_sanctions" ("userId","revokedAt","endsAt");--> statement-breakpoint
CREATE INDEX "core_moderation_sanctions_created_at_id_idx" ON "core_moderation_sanctions" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_moderation_warning_reasons_position_idx" ON "core_moderation_warning_reasons" ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "core_moderation_warning_thresholds_enabled_points_idx" ON "core_moderation_warning_thresholds" ("points") WHERE "enabled" = true;--> statement-breakpoint
CREATE INDEX "core_moderation_warnings_user_idx" ON "core_moderation_warnings" ("userId","issuedAt");--> statement-breakpoint
CREATE INDEX "core_moderation_warnings_issued_at_id_idx" ON "core_moderation_warnings" ("issuedAt","id");--> statement-breakpoint
CREATE INDEX "core_moderation_warnings_issued_by_idx" ON "core_moderation_warnings" ("issuedById");--> statement-breakpoint
CREATE INDEX "core_moderation_warnings_reason_idx" ON "core_moderation_warnings" ("reasonId");--> statement-breakpoint
CREATE INDEX "core_moderation_warnings_target_idx" ON "core_moderation_warnings" ("pluginId","targetType","targetId");--> statement-breakpoint
CREATE INDEX "core_moderation_warnings_report_idx" ON "core_moderation_warnings" ("reportId");--> statement-breakpoint
ALTER TABLE "core_moderation_sanctions" ADD CONSTRAINT "core_moderation_sanctions_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_moderation_sanctions" ADD CONSTRAINT "core_moderation_sanctions_rlFetAHphSkc_fkey" FOREIGN KEY ("warningId") REFERENCES "core_moderation_warnings"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_sanctions" ADD CONSTRAINT "core_moderation_sanctions_ejX3lH3GN7oz_fkey" FOREIGN KEY ("thresholdId") REFERENCES "core_moderation_warning_thresholds"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_sanctions" ADD CONSTRAINT "core_moderation_sanctions_createdById_core_users_id_fkey" FOREIGN KEY ("createdById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_sanctions" ADD CONSTRAINT "core_moderation_sanctions_revokedById_core_users_id_fkey" FOREIGN KEY ("revokedById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_warnings" ADD CONSTRAINT "core_moderation_warnings_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_moderation_warnings" ADD CONSTRAINT "core_moderation_warnings_issuedById_core_users_id_fkey" FOREIGN KEY ("issuedById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_warnings" ADD CONSTRAINT "core_moderation_warnings_J1JvecLI20Z2_fkey" FOREIGN KEY ("reasonId") REFERENCES "core_moderation_warning_reasons"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_warnings" ADD CONSTRAINT "core_moderation_warnings_0vlCswFpT46n_fkey" FOREIGN KEY ("reportId") REFERENCES "core_moderation_reports"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_moderation_warnings" ADD CONSTRAINT "core_moderation_warnings_revokedById_core_users_id_fkey" FOREIGN KEY ("revokedById") REFERENCES "core_users"("id") ON DELETE SET NULL;