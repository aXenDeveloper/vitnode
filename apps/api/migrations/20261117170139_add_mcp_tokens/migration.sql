CREATE TABLE "core_mcp_tokens" (
	"id" serial PRIMARY KEY,
	"userId" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"prefix" varchar(32) NOT NULL,
	"tokenHash" varchar(64) NOT NULL UNIQUE,
	"tools" jsonb NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"revokedAt" timestamp,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_mcp_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "core_mcp_tokens_user_id_idx" ON "core_mcp_tokens" ("userId");--> statement-breakpoint
ALTER TABLE "core_mcp_tokens" ADD CONSTRAINT "core_mcp_tokens_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;