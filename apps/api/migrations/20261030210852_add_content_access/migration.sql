CREATE TABLE "core_content_access_rule_roles" (
	"ruleId" integer,
	"roleId" integer,
	CONSTRAINT "core_content_access_rule_roles_pkey" PRIMARY KEY("ruleId","roleId")
);
--> statement-breakpoint
ALTER TABLE "core_content_access_rule_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_content_access_rules" (
	"id" serial PRIMARY KEY,
	"family" varchar(100) NOT NULL,
	"scopeId" varchar(64) NOT NULL,
	"action" varchar(32) NOT NULL,
	"mode" varchar(16) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_content_access_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_files" ADD COLUMN "visibility" varchar(16) DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "core_search_index" ADD COLUMN "accessScopes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "core_content_access_rule_roles_role_id_idx" ON "core_content_access_rule_roles" ("roleId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_content_access_rules_scope_action_key" ON "core_content_access_rules" ("family","scopeId","action");--> statement-breakpoint
CREATE INDEX "core_search_index_access_scopes_idx" ON "core_search_index" USING gin ("accessScopes");--> statement-breakpoint
ALTER TABLE "core_content_access_rule_roles" ADD CONSTRAINT "core_content_access_rule_roles_AM3iX4qZcV8y_fkey" FOREIGN KEY ("ruleId") REFERENCES "core_content_access_rules"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_content_access_rule_roles" ADD CONSTRAINT "core_content_access_rule_roles_roleId_core_roles_id_fkey" FOREIGN KEY ("roleId") REFERENCES "core_roles"("id") ON DELETE CASCADE;