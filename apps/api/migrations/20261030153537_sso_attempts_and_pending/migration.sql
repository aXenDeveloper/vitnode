CREATE TABLE "core_sso_attempts" (
	"id" serial PRIMARY KEY,
	"stateHash" varchar(64) NOT NULL UNIQUE,
	"bindingHash" varchar(64) NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"codeVerifier" varchar(128) NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_sso_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_sso_pending" (
	"id" serial PRIMARY KEY,
	"tokenHash" varchar(64) NOT NULL UNIQUE,
	"providerId" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"providerUsername" varchar(255),
	"profile" jsonb,
	"email" varchar(255),
	"confirmHash" varchar(64),
	"confirmExpiresAt" timestamp,
	"confirmSends" integer DEFAULT 0 NOT NULL,
	"confirmSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_sso_pending" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_users_sso_operations" ADD COLUMN "codeVerifier" varchar(128);--> statement-breakpoint
ALTER TABLE "core_users_sso_operations" ADD COLUMN "nonce" varchar(128);--> statement-breakpoint
CREATE INDEX "core_sso_attempts_expires_at_idx" ON "core_sso_attempts" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_sso_pending_expires_at_idx" ON "core_sso_pending" ("expiresAt");