CREATE TABLE "core_mcp_access_tokens" (
	"id" serial PRIMARY KEY,
	"tokenHash" varchar(64) NOT NULL UNIQUE,
	"grantId" integer NOT NULL,
	"scopes" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_mcp_access_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_mcp_authorization_codes" (
	"id" serial PRIMARY KEY,
	"codeHash" varchar(64) NOT NULL UNIQUE,
	"clientId" integer NOT NULL,
	"userId" integer NOT NULL,
	"redirectUri" varchar(2048) NOT NULL,
	"codeChallenge" varchar(128) NOT NULL,
	"scopes" jsonb NOT NULL,
	"resource" varchar(512) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp,
	"grantId" integer
);
--> statement-breakpoint
ALTER TABLE "core_mcp_authorization_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_mcp_clients" (
	"id" serial PRIMARY KEY,
	"clientId" varchar(64) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"uri" varchar(512),
	"redirectUris" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_mcp_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_mcp_grants" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"clientId" integer NOT NULL,
	"scopes" jsonb NOT NULL,
	"resource" varchar(512) NOT NULL,
	"refreshTokenHash" varchar(64) NOT NULL UNIQUE,
	"previousRefreshTokenHash" varchar(64) UNIQUE,
	"refreshTokenExpiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_mcp_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_mcp_access_tokens_grant_id_idx" ON "core_mcp_access_tokens" ("grantId");--> statement-breakpoint
CREATE INDEX "core_mcp_access_tokens_expires_at_idx" ON "core_mcp_access_tokens" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_mcp_authorization_codes_client_id_idx" ON "core_mcp_authorization_codes" ("clientId");--> statement-breakpoint
CREATE INDEX "core_mcp_authorization_codes_user_id_idx" ON "core_mcp_authorization_codes" ("userId");--> statement-breakpoint
CREATE INDEX "core_mcp_authorization_codes_grant_id_idx" ON "core_mcp_authorization_codes" ("grantId");--> statement-breakpoint
CREATE INDEX "core_mcp_authorization_codes_expires_at_idx" ON "core_mcp_authorization_codes" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_mcp_clients_created_at_idx" ON "core_mcp_clients" ("createdAt");--> statement-breakpoint
CREATE INDEX "core_mcp_grants_user_id_idx" ON "core_mcp_grants" ("userId");--> statement-breakpoint
CREATE INDEX "core_mcp_grants_client_id_idx" ON "core_mcp_grants" ("clientId");--> statement-breakpoint
CREATE INDEX "core_mcp_grants_refresh_token_expires_at_idx" ON "core_mcp_grants" ("refreshTokenExpiresAt");--> statement-breakpoint
ALTER TABLE "core_mcp_access_tokens" ADD CONSTRAINT "core_mcp_access_tokens_grantId_core_mcp_grants_id_fkey" FOREIGN KEY ("grantId") REFERENCES "core_mcp_grants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_mcp_authorization_codes" ADD CONSTRAINT "core_mcp_authorization_codes_clientId_core_mcp_clients_id_fkey" FOREIGN KEY ("clientId") REFERENCES "core_mcp_clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_mcp_authorization_codes" ADD CONSTRAINT "core_mcp_authorization_codes_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_mcp_authorization_codes" ADD CONSTRAINT "core_mcp_authorization_codes_grantId_core_mcp_grants_id_fkey" FOREIGN KEY ("grantId") REFERENCES "core_mcp_grants"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_mcp_grants" ADD CONSTRAINT "core_mcp_grants_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_mcp_grants" ADD CONSTRAINT "core_mcp_grants_clientId_core_mcp_clients_id_fkey" FOREIGN KEY ("clientId") REFERENCES "core_mcp_clients"("id") ON DELETE CASCADE;