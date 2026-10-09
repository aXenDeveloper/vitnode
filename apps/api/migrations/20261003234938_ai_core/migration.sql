CREATE TABLE "core_ai_action_settings" (
	"actionKey" varchar(255) PRIMARY KEY,
	"enabled" boolean DEFAULT true NOT NULL,
	"modelId" varchar(100),
	"fallbackModelId" varchar(100),
	"maxInputCharacters" integer,
	"maxOutputTokens" integer,
	"timeoutMs" integer,
	"maxRetries" integer,
	"maxSteps" integer,
	"dailyLimit" integer,
	"instructions" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_action_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_budget_periods" (
	"id" serial PRIMARY KEY,
	"scopeKey" varchar(255) NOT NULL,
	"unit" varchar(10) NOT NULL,
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"limitAmount" numeric(24,12),
	"spentAmount" numeric(24,12) DEFAULT '0' NOT NULL,
	"reservedAmount" numeric(24,12) DEFAULT '0' NOT NULL,
	"unknownCount" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_budget_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_calls" (
	"id" serial PRIMARY KEY,
	"runId" integer NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"modelId" varchar(100) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"providerModelId" varchar(255),
	"providerRequestId" varchar(255),
	"status" varchar(20) NOT NULL,
	"errorCode" varchar(64),
	"inputTokens" integer,
	"outputTokens" integer,
	"cacheReadTokens" integer,
	"cacheWriteTokens" integer,
	"reasoningTokens" integer,
	"images" integer DEFAULT 0 NOT NULL,
	"costUsd" numeric(24,12),
	"costSource" varchar(20) NOT NULL,
	"costReason" varchar(255),
	"pricingVersion" varchar(100),
	"pricingSnapshot" jsonb,
	"startedAt" timestamp NOT NULL,
	"finishedAt" timestamp,
	"reconciledAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_ai_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_cost_adjustments" (
	"id" serial PRIMARY KEY,
	"callId" integer NOT NULL,
	"runId" integer NOT NULL,
	"previousCostUsd" numeric(24,12),
	"previousSource" varchar(20) NOT NULL,
	"newCostUsd" numeric(24,12) NOT NULL,
	"newSource" varchar(20) NOT NULL,
	"deltaUsd" numeric(24,12) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_cost_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_pricing" (
	"id" serial PRIMARY KEY,
	"modelId" varchar(100) NOT NULL,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"pricing" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_pricing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_reservations" (
	"id" serial PRIMARY KEY,
	"runId" integer NOT NULL,
	"budgetPeriodId" integer NOT NULL,
	"amount" numeric(24,12) NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"settledAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_ai_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_role_permissions" (
	"roleId" integer,
	"permission" varchar(255),
	"granted" boolean DEFAULT true NOT NULL,
	"dailyLimit" integer,
	CONSTRAINT "core_ai_role_permissions_pkey" PRIMARY KEY("roleId","permission")
);
--> statement-breakpoint
ALTER TABLE "core_ai_role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_role_policies" (
	"roleId" integer PRIMARY KEY,
	"monthlyPoints" numeric(24,12),
	"unlimited" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_role_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_runs" (
	"id" serial PRIMARY KEY,
	"actionKey" varchar(255) NOT NULL,
	"pluginId" varchar(100) NOT NULL,
	"actorType" varchar(10) NOT NULL,
	"userId" integer,
	"idempotencyKey" varchar(255),
	"resourceType" varchar(100),
	"resourceId" varchar(255),
	"status" varchar(20) NOT NULL,
	"errorCode" varchar(64),
	"promptVersion" integer NOT NULL,
	"pointsConversionVersion" integer NOT NULL,
	"modelId" varchar(100),
	"provider" varchar(100),
	"providerModelId" varchar(255),
	"inputTokens" integer,
	"outputTokens" integer,
	"cacheReadTokens" integer,
	"cacheWriteTokens" integer,
	"reasoningTokens" integer,
	"costUsd" numeric(24,12),
	"costSource" varchar(20),
	"chargedUsd" numeric(24,12),
	"chargedPoints" numeric(24,12),
	"reservedUsd" numeric(24,12) DEFAULT '0' NOT NULL,
	"reservedPoints" numeric(24,12) DEFAULT '0' NOT NULL,
	"settlement" varchar(20) DEFAULT 'pending' NOT NULL,
	"leaseExpiresAt" timestamp,
	"accepted" boolean,
	"acceptedAt" timestamp,
	"sourceFingerprint" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"settledAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "core_ai_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"enabled" boolean DEFAULT true NOT NULL,
	"monthlyBudgetUsd" numeric(24,12),
	"systemMonthlyBudgetUsd" numeric(24,12),
	"defaultMonthlyPoints" numeric(24,12) DEFAULT '0' NOT NULL,
	"pointsConversionVersion" integer DEFAULT 1 NOT NULL,
	"userRequestsPerMinute" integer DEFAULT 10 NOT NULL,
	"userConcurrency" integer DEFAULT 2 NOT NULL,
	"systemConcurrency" integer DEFAULT 2 NOT NULL,
	"historyRetentionDays" integer DEFAULT 365 NOT NULL,
	"altEnabled" boolean DEFAULT false NOT NULL,
	"altLanguages" jsonb,
	"altBatchSize" integer DEFAULT 10 NOT NULL,
	"altScanCursor" integer DEFAULT 0 NOT NULL,
	"altScanStartedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_ai_user_overrides" (
	"userId" integer PRIMARY KEY,
	"monthlyPoints" numeric(24,12),
	"unlimited" boolean DEFAULT false NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_ai_user_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_budget_periods_scope_unique" ON "core_ai_budget_periods" ("scopeKey","periodStart");--> statement-breakpoint
CREATE INDEX "core_ai_calls_run_idx" ON "core_ai_calls" ("runId");--> statement-breakpoint
CREATE INDEX "core_ai_calls_reconcile_idx" ON "core_ai_calls" ("costSource","reconciledAt");--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_cost_adjustments_call_unique" ON "core_ai_cost_adjustments" ("callId");--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_pricing_active_unique" ON "core_ai_pricing" ("modelId","source") WHERE active;--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_reservations_run_period_unique" ON "core_ai_reservations" ("runId","budgetPeriodId");--> statement-breakpoint
CREATE INDEX "core_ai_reservations_status_idx" ON "core_ai_reservations" ("status");--> statement-breakpoint
CREATE INDEX "core_ai_runs_user_created_idx" ON "core_ai_runs" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "core_ai_runs_created_idx" ON "core_ai_runs" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_ai_runs_action_created_idx" ON "core_ai_runs" ("actionKey","createdAt");--> statement-breakpoint
CREATE INDEX "core_ai_runs_status_idx" ON "core_ai_runs" ("status","leaseExpiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_runs_idempotency_unique" ON "core_ai_runs" ("actorType","userId","idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "core_ai_calls" ADD CONSTRAINT "core_ai_calls_runId_core_ai_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "core_ai_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_cost_adjustments" ADD CONSTRAINT "core_ai_cost_adjustments_callId_core_ai_calls_id_fkey" FOREIGN KEY ("callId") REFERENCES "core_ai_calls"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_cost_adjustments" ADD CONSTRAINT "core_ai_cost_adjustments_runId_core_ai_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "core_ai_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_pricing" ADD CONSTRAINT "core_ai_pricing_createdById_core_users_id_fkey" FOREIGN KEY ("createdById") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_ai_reservations" ADD CONSTRAINT "core_ai_reservations_runId_core_ai_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "core_ai_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_reservations" ADD CONSTRAINT "core_ai_reservations_FClYpPXZwvsm_fkey" FOREIGN KEY ("budgetPeriodId") REFERENCES "core_ai_budget_periods"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_role_permissions" ADD CONSTRAINT "core_ai_role_permissions_roleId_core_roles_id_fkey" FOREIGN KEY ("roleId") REFERENCES "core_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_role_policies" ADD CONSTRAINT "core_ai_role_policies_roleId_core_roles_id_fkey" FOREIGN KEY ("roleId") REFERENCES "core_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "core_ai_runs" ADD CONSTRAINT "core_ai_runs_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "core_ai_user_overrides" ADD CONSTRAINT "core_ai_user_overrides_userId_core_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE;