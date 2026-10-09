CREATE TABLE "core_files_alt" (
	"id" serial PRIMARY KEY,
	"fileId" integer NOT NULL,
	"languageCode" varchar(32) NOT NULL,
	"text" text NOT NULL,
	"origin" varchar(10) NOT NULL,
	"fileFingerprint" varchar(64),
	"runId" integer,
	"updatedById" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_files_alt" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_files_alt_analysis" (
	"id" serial PRIMARY KEY,
	"fileId" integer NOT NULL,
	"fileFingerprint" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"runId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_files_alt_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_files_alt_state" (
	"fileId" integer PRIMARY KEY,
	"status" varchar(20) NOT NULL,
	"lastError" varchar(255),
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_files_alt_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_files" ADD COLUMN "fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "core_files" ADD COLUMN "altPolicy" varchar(16) DEFAULT 'automatic' NOT NULL;--> statement-breakpoint
ALTER TABLE "core_queue" ADD COLUMN "dedupeKey" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "core_files_alt_file_language_unique" ON "core_files_alt" ("fileId","languageCode");--> statement-breakpoint
CREATE UNIQUE INDEX "core_files_alt_analysis_file_unique" ON "core_files_alt_analysis" ("fileId","fileFingerprint");--> statement-breakpoint
CREATE INDEX "core_files_alt_state_status_idx" ON "core_files_alt_state" ("status") WHERE status <> 'completed';--> statement-breakpoint
CREATE UNIQUE INDEX "core_queue_dedupe_active_unique" ON "core_queue" ("pluginId","dedupeKey") WHERE "dedupeKey" IS NOT NULL AND status IN ('pending', 'processing');--> statement-breakpoint
ALTER TABLE "core_files_alt" ADD CONSTRAINT "core_files_alt_fileId_core_files_id_fkey" FOREIGN KEY ("fileId") REFERENCES "core_files"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_files_alt" ADD CONSTRAINT "core_files_alt_languageCode_core_languages_code_fkey" FOREIGN KEY ("languageCode") REFERENCES "core_languages"("code") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_files_alt" ADD CONSTRAINT "core_files_alt_runId_core_ai_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "core_ai_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_files_alt" ADD CONSTRAINT "core_files_alt_updatedById_core_users_id_fkey" FOREIGN KEY ("updatedById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_files_alt_analysis" ADD CONSTRAINT "core_files_alt_analysis_fileId_core_files_id_fkey" FOREIGN KEY ("fileId") REFERENCES "core_files"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_files_alt_analysis" ADD CONSTRAINT "core_files_alt_analysis_runId_core_ai_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "core_ai_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_files_alt_state" ADD CONSTRAINT "core_files_alt_state_fileId_core_files_id_fkey" FOREIGN KEY ("fileId") REFERENCES "core_files"("id") ON DELETE CASCADE;