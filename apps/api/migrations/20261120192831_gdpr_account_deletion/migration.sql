CREATE TABLE "core_users_deletions" (
	"id" serial PRIMARY KEY,
	"userId" integer,
	"erasedUserId" integer NOT NULL,
	"source" varchar(16) NOT NULL,
	"requestedById" integer,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"scheduledAt" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"filesDeleted" integer DEFAULT 0 NOT NULL,
	"filesKept" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"cancelledAt" timestamp,
	"completedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_users_deletions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "allowDeleteAccount" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users" ALTER COLUMN "ipAddress" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "core_users_deletions_pending_user_unique" ON "core_users_deletions" ("userId") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "core_users_deletions_status_scheduled_idx" ON "core_users_deletions" ("status","scheduledAt");--> statement-breakpoint
CREATE INDEX "core_users_deletions_erased_user_idx" ON "core_users_deletions" ("erasedUserId");--> statement-breakpoint
CREATE INDEX "core_users_deletions_created_at_id_idx" ON "core_users_deletions" ("createdAt","id");--> statement-breakpoint
ALTER TABLE "core_users_deletions" ADD CONSTRAINT "core_users_deletions_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_users_deletions" ADD CONSTRAINT "core_users_deletions_requestedById_core_users_id_fkey" FOREIGN KEY ("requestedById") REFERENCES "core_users"("id") ON DELETE SET NULL;