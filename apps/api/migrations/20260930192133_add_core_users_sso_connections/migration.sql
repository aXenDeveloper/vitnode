CREATE TABLE "core_users_sso_operations" (
	"id" serial PRIMARY KEY,
	"tokenHash" varchar(64) UNIQUE,
	"userId" integer NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"intent" varchar(16) NOT NULL,
	"fields" varchar(32)[] DEFAULT '{}'::varchar(32)[] NOT NULL,
	"providerAccountId" varchar(255),
	"preview" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "core_users_sso_operations_intent_check" CHECK ("intent" IN ('link', 'import', 'preview'))
);
--> statement-breakpoint
ALTER TABLE "core_users_sso_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users_sso_profile_sources" (
	"userId" integer,
	"field" varchar(32),
	"providerId" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_users_sso_profile_sources_pkey" PRIMARY KEY("userId","field"),
	CONSTRAINT "core_users_sso_profile_sources_field_check" CHECK ("field" IN ('avatar', 'firstName', 'lastName'))
);
--> statement-breakpoint
ALTER TABLE "core_users_sso_profile_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD COLUMN "providerEmail" varchar(255);--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD COLUMN "providerUsername" varchar(255);--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD COLUMN "syncOnSignIn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD COLUMN "avatarSourceUrl" varchar(2048);--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD COLUMN "avatarSha256" varchar(64);--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD COLUMN "avatarFileId" integer;--> statement-breakpoint
DELETE FROM "core_users_sso" AS "duplicate" USING "core_users_sso" AS "kept" WHERE "duplicate"."providerId" = "kept"."providerId" AND "duplicate"."providerAccountId" = "kept"."providerAccountId" AND ("duplicate"."createdAt", "duplicate".ctid) > ("kept"."createdAt", "kept".ctid);--> statement-breakpoint
DELETE FROM "core_users_sso" AS "duplicate" USING "core_users_sso" AS "kept" WHERE "duplicate"."userId" = "kept"."userId" AND "duplicate"."providerId" = "kept"."providerId" AND ("duplicate"."createdAt", "duplicate".ctid) > ("kept"."createdAt", "kept".ctid);--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD CONSTRAINT "core_users_sso_provider_account_key" UNIQUE("providerId","providerAccountId");--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD CONSTRAINT "core_users_sso_user_provider_key" UNIQUE("userId","providerId");--> statement-breakpoint
CREATE INDEX "core_users_sso_operations_user_provider_idx" ON "core_users_sso_operations" ("userId","providerId");--> statement-breakpoint
CREATE INDEX "core_users_sso_operations_expires_at_idx" ON "core_users_sso_operations" ("expiresAt");--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD CONSTRAINT "core_users_sso_avatarFileId_core_files_id_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "core_files"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_users_sso_operations" ADD CONSTRAINT "core_users_sso_operations_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_users_sso_profile_sources" ADD CONSTRAINT "core_users_sso_profile_sources_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_users_sso_profile_sources" ADD CONSTRAINT "core_users_sso_profile_sources_connection_fkey" FOREIGN KEY ("userId","providerId") REFERENCES "core_users_sso"("userId","providerId") ON DELETE CASCADE;