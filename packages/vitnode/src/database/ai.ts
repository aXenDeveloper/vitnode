import { sql } from "drizzle-orm";
import { camelCase, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

import type { AiPricing } from "@/api/lib/ai/pricing";

import { core_roles } from "./roles";
import { core_users } from "./users";

const money = { precision: 24, scale: 12 } as const;

export const core_ai_settings = camelCase.table.withRLS(
  "core_ai_settings",
  t => ({
    id: t.integer().primaryKey().default(1),
    enabled: t.boolean().notNull().default(true),
    monthlyBudgetUsd: t.numeric(money),
    systemMonthlyBudgetUsd: t.numeric(money),
    defaultMonthlyPoints: t.numeric(money).notNull().default("0"),
    pointsConversionVersion: t.integer().notNull().default(1),
    userRequestsPerMinute: t.integer().notNull().default(10),
    userConcurrency: t.integer().notNull().default(2),
    systemConcurrency: t.integer().notNull().default(2),
    historyRetentionDays: t.integer().notNull().default(365),
    altEnabled: t.boolean().notNull().default(false),
    altBatchSize: t.integer().notNull().default(10),
    altScanCursor: t.integer().notNull().default(0),
    altScanStartedAt: t.timestamp(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);

export const core_ai_action_settings = camelCase.table.withRLS(
  "core_ai_action_settings",
  t => ({
    actionKey: t.varchar({ length: 255 }).primaryKey(),
    enabled: t.boolean().notNull().default(true),
    modelId: t.varchar({ length: 100 }),
    fallbackModelId: t.varchar({ length: 100 }),
    maxInputCharacters: t.integer(),
    maxOutputTokens: t.integer(),
    timeoutMs: t.integer(),
    maxRetries: t.integer(),
    maxSteps: t.integer(),
    dailyLimit: t.integer(),
    instructions: t.text(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);

export const core_ai_role_policies = camelCase.table.withRLS(
  "core_ai_role_policies",
  t => ({
    roleId: t
      .integer()
      .primaryKey()
      .references(() => core_roles.id, { onDelete: "cascade" }),
    monthlyPoints: t.numeric(money),
    unlimited: t.boolean().notNull().default(false),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);

export const core_ai_role_permissions = camelCase.table.withRLS(
  "core_ai_role_permissions",
  t => ({
    roleId: t
      .integer()
      .notNull()
      .references(() => core_roles.id, { onDelete: "cascade" }),
    permission: t.varchar({ length: 255 }).notNull(),
    granted: t.boolean().notNull().default(true),
    dailyLimit: t.integer(),
  }),
  t => [primaryKey({ columns: [t.roleId, t.permission] })],
);

export const core_ai_user_overrides = camelCase.table.withRLS(
  "core_ai_user_overrides",
  t => ({
    userId: t
      .integer()
      .primaryKey()
      .references(() => core_users.id, { onDelete: "cascade" }),
    monthlyPoints: t.numeric(money),
    unlimited: t.boolean().notNull().default(false),
    blocked: t.boolean().notNull().default(false),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);

export const AI_RUN_STATUSES = [
  "reserved",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "uncertain",
] as const;

export const core_ai_runs = camelCase.table.withRLS(
  "core_ai_runs",
  t => ({
    id: t.serial().primaryKey(),
    actionKey: t.varchar({ length: 255 }).notNull(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    actorType: t.varchar({ enum: ["system", "user"], length: 10 }).notNull(),
    userId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    idempotencyKey: t.varchar({ length: 255 }),
    resourceType: t.varchar({ length: 100 }),
    resourceId: t.varchar({ length: 255 }),
    status: t.varchar({ enum: AI_RUN_STATUSES, length: 20 }).notNull(),
    errorCode: t.varchar({ length: 64 }),
    promptVersion: t.integer().notNull(),
    pointsConversionVersion: t.integer().notNull(),
    modelId: t.varchar({ length: 100 }),
    provider: t.varchar({ length: 100 }),
    providerModelId: t.varchar({ length: 255 }),
    inputTokens: t.integer(),
    outputTokens: t.integer(),
    cacheReadTokens: t.integer(),
    cacheWriteTokens: t.integer(),
    reasoningTokens: t.integer(),
    costUsd: t.numeric(money),
    costSource: t.varchar({
      enum: ["pricing", "provider", "unknown", "mixed"],
      length: 20,
    }),
    chargedUsd: t.numeric(money),
    chargedPoints: t.numeric(money),
    reservedUsd: t.numeric(money).notNull().default("0"),
    reservedPoints: t.numeric(money).notNull().default("0"),
    settlement: t
      .varchar({ enum: ["pending", "settled", "reconciling"], length: 20 })
      .notNull()
      .default("pending"),
    leaseExpiresAt: t.timestamp(),
    accepted: t.boolean(),
    acceptedAt: t.timestamp(),
    sourceFingerprint: t.varchar({ length: 64 }),
    createdAt: t.timestamp().notNull().defaultNow(),
    startedAt: t.timestamp(),
    finishedAt: t.timestamp(),
    settledAt: t.timestamp(),
  }),
  t => [
    index("core_ai_runs_user_created_idx").on(t.userId, t.createdAt),
    index("core_ai_runs_created_idx").on(t.createdAt, t.id),
    index("core_ai_runs_action_created_idx").on(t.actionKey, t.createdAt),
    index("core_ai_runs_status_idx").on(t.status, t.leaseExpiresAt),
    uniqueIndex("core_ai_runs_idempotency_unique")
      .on(t.actorType, t.userId, t.idempotencyKey)
      .where(sql`"idempotencyKey" IS NOT NULL`),
  ],
);

export const core_ai_calls = camelCase.table.withRLS(
  "core_ai_calls",
  t => ({
    id: t.serial().primaryKey(),
    runId: t
      .integer()
      .notNull()
      .references(() => core_ai_runs.id, { onDelete: "cascade" }),
    attempt: t.integer().notNull().default(1),
    modelId: t.varchar({ length: 100 }).notNull(),
    provider: t.varchar({ length: 100 }).notNull(),
    providerModelId: t.varchar({ length: 255 }),
    providerRequestId: t.varchar({ length: 255 }),
    status: t
      .varchar({ enum: ["succeeded", "failed", "uncertain"], length: 20 })
      .notNull(),
    errorCode: t.varchar({ length: 64 }),
    inputTokens: t.integer(),
    outputTokens: t.integer(),
    cacheReadTokens: t.integer(),
    cacheWriteTokens: t.integer(),
    reasoningTokens: t.integer(),
    images: t.integer().notNull().default(0),
    costUsd: t.numeric(money),
    costSource: t
      .varchar({
        enum: ["pricing", "provider", "unknown"],
        length: 20,
      })
      .notNull(),
    costReason: t.varchar({ length: 255 }),
    pricingVersion: t.varchar({ length: 100 }),
    pricingSnapshot: t.jsonb().$type<AiPricing>(),
    startedAt: t.timestamp().notNull(),
    finishedAt: t.timestamp(),
    reconciledAt: t.timestamp(),
  }),
  t => [
    index("core_ai_calls_run_idx").on(t.runId),
    index("core_ai_calls_reconcile_idx").on(t.costSource, t.reconciledAt),
  ],
);

export const core_ai_cost_adjustments = camelCase.table.withRLS(
  "core_ai_cost_adjustments",
  t => ({
    id: t.serial().primaryKey(),
    callId: t
      .integer()
      .notNull()
      .references(() => core_ai_calls.id, { onDelete: "cascade" }),
    runId: t
      .integer()
      .notNull()
      .references(() => core_ai_runs.id, { onDelete: "cascade" }),
    previousCostUsd: t.numeric(money),
    previousSource: t.varchar({ length: 20 }).notNull(),
    newCostUsd: t.numeric(money).notNull(),
    newSource: t.varchar({ length: 20 }).notNull(),
    deltaUsd: t.numeric(money).notNull(),
    reason: t.varchar({ length: 255 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [uniqueIndex("core_ai_cost_adjustments_call_unique").on(t.callId)],
);

export const core_ai_budget_periods = camelCase.table.withRLS(
  "core_ai_budget_periods",
  t => ({
    id: t.serial().primaryKey(),
    scopeKey: t.varchar({ length: 255 }).notNull(),
    unit: t.varchar({ enum: ["count", "points", "usd"], length: 10 }).notNull(),
    periodStart: t.timestamp().notNull(),
    periodEnd: t.timestamp().notNull(),
    limitAmount: t.numeric(money),
    spentAmount: t.numeric(money).notNull().default("0"),
    reservedAmount: t.numeric(money).notNull().default("0"),
    unknownCount: t.integer().notNull().default(0),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_ai_budget_periods_scope_unique").on(
      t.scopeKey,
      t.periodStart,
    ),
  ],
);

export const core_ai_reservations = camelCase.table.withRLS(
  "core_ai_reservations",
  t => ({
    id: t.serial().primaryKey(),
    runId: t
      .integer()
      .notNull()
      .references(() => core_ai_runs.id, { onDelete: "cascade" }),
    budgetPeriodId: t
      .integer()
      .notNull()
      .references(() => core_ai_budget_periods.id, { onDelete: "cascade" }),
    amount: t.numeric(money).notNull(),
    status: t
      .varchar({ enum: ["active", "settled"], length: 10 })
      .notNull()
      .default("active"),
    createdAt: t.timestamp().notNull().defaultNow(),
    settledAt: t.timestamp(),
  }),
  t => [
    uniqueIndex("core_ai_reservations_run_period_unique").on(
      t.runId,
      t.budgetPeriodId,
    ),
    index("core_ai_reservations_status_idx").on(t.status),
  ],
);

export const core_ai_translation_sources = camelCase.table.withRLS(
  "core_ai_translation_sources",
  t => ({
    id: t.serial().primaryKey(),
    contentTypeId: t.varchar({ length: 255 }).notNull(),
    itemId: t.integer().notNull(),
    locale: t.varchar({ length: 32 }).notNull(),
    field: t.varchar({ length: 255 }).notNull(),
    sourceLocale: t.varchar({ length: 32 }).notNull(),
    sourceFingerprint: t.varchar({ length: 64 }).notNull(),
    targetFingerprint: t.varchar({ length: 64 }).notNull(),
    origin: t.varchar({ enum: ["ai", "human"], length: 10 }).notNull(),
    updatedById: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_ai_translation_sources_unique").on(
      t.contentTypeId,
      t.itemId,
      t.locale,
      t.field,
    ),
  ],
);
