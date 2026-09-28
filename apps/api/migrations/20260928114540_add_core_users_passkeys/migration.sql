CREATE TABLE "core_users_passkey_challenges" (
	"id" serial PRIMARY KEY,
	"tokenHash" varchar(64) NOT NULL UNIQUE,
	"ceremony" varchar(16) NOT NULL,
	"challenge" varchar(128) NOT NULL,
	"userId" integer,
	"webauthnUserId" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_users_passkey_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users_passkeys" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"credentialId" varchar(1024) NOT NULL UNIQUE,
	"publicKey" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"webauthnUserId" varchar(128) NOT NULL,
	"transports" varchar(32)[] DEFAULT '{}'::varchar(32)[] NOT NULL,
	"deviceType" varchar(32) NOT NULL,
	"backedUp" boolean DEFAULT false NOT NULL,
	"aaguid" varchar(36),
	"name" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_users_passkeys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_users_passkey_challenges_expires_at_idx" ON "core_users_passkey_challenges" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_users_passkey_challenges_user_id_idx" ON "core_users_passkey_challenges" ("userId");--> statement-breakpoint
CREATE INDEX "core_users_passkeys_user_id_idx" ON "core_users_passkeys" ("userId");--> statement-breakpoint
CREATE INDEX "core_users_passkeys_webauthn_user_id_idx" ON "core_users_passkeys" ("webauthnUserId");--> statement-breakpoint
ALTER TABLE "core_users_passkey_challenges" ADD CONSTRAINT "core_users_passkey_challenges_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_users_passkeys" ADD CONSTRAINT "core_users_passkeys_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;