CREATE TABLE "core_content_ai_translation_jobs" (
	"id" serial PRIMARY KEY,
	"targetKind" varchar(20) DEFAULT 'content' NOT NULL,
	"contentTypeId" varchar(150) NOT NULL,
	"recordId" varchar(64) NOT NULL,
	"field" varchar(100) NOT NULL,
	"sourceFingerprint" varchar(64) NOT NULL,
	"targetLocale" varchar(32) NOT NULL,
	"mode" varchar(10) DEFAULT 'automatic' NOT NULL,
	"sourceLocaleHint" varchar(32),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" varchar(40),
	"attempts" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 3 NOT NULL,
	"availableAt" timestamp DEFAULT now() NOT NULL,
	"leaseOwner" varchar(36),
	"leaseExpiresAt" timestamp,
	"requestedBy" integer,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"runId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_ai_translation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_content_ai_translations" (
	"id" serial PRIMARY KEY,
	"targetKind" varchar(20) DEFAULT 'content' NOT NULL,
	"contentTypeId" varchar(150) NOT NULL,
	"recordId" varchar(64) NOT NULL,
	"field" varchar(100) NOT NULL,
	"sourceFingerprint" varchar(64) NOT NULL,
	"targetLocale" varchar(32) NOT NULL,
	"sourceLocale" varchar(32),
	"value" jsonb NOT NULL,
	"runId" integer,
	"modelId" varchar(100),
	"promptVersion" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"supersededAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_content_ai_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_content_language_detections" (
	"textFingerprint" varchar(64) PRIMARY KEY,
	"locale" varchar(32),
	"confident" boolean NOT NULL,
	"detectorVersion" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_language_detections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_content_translation_settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"enabled" boolean DEFAULT false NOT NULL,
	"locales" jsonb DEFAULT '["en","pl"]' NOT NULL,
	"monthlyBudgetUsd" numeric(24,12) DEFAULT '5',
	"userHourlyLimit" integer DEFAULT 100 NOT NULL,
	"retentionDays" integer DEFAULT 30 NOT NULL,
	"cleanupCursor" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_translation_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_users" ADD COLUMN "autoTranslateContent" boolean;--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_ai_translation_jobs_key_unique" ON "core_content_ai_translation_jobs" ("targetKind","contentTypeId","recordId","field","sourceFingerprint","targetLocale");--> statement-breakpoint
CREATE INDEX "core_content_ai_translation_jobs_status_idx" ON "core_content_ai_translation_jobs" ("status","availableAt");--> statement-breakpoint
CREATE INDEX "core_content_ai_translation_jobs_requester_idx" ON "core_content_ai_translation_jobs" ("requestedBy","requestedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_ai_translations_key_unique" ON "core_content_ai_translations" ("targetKind","contentTypeId","recordId","field","sourceFingerprint","targetLocale");--> statement-breakpoint
CREATE INDEX "core_content_ai_translations_record_idx" ON "core_content_ai_translations" ("contentTypeId","recordId");--> statement-breakpoint
CREATE INDEX "core_content_ai_translations_superseded_idx" ON "core_content_ai_translations" ("supersededAt") WHERE "supersededAt" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "core_content_ai_translation_jobs" ADD CONSTRAINT "core_content_ai_translation_jobs_requestedBy_core_users_id_fkey" FOREIGN KEY ("requestedBy") REFERENCES "core_users"("id") ON DELETE SET NULL;