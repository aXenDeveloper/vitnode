import { and, asc, count, eq, gt, inArray, or, sql } from "drizzle-orm";

import type { EnvVariablesVitNode } from "../../middlewares/global.middleware";
import type { AiBudgetRowState } from "./budget";
import type { Decimal } from "./decimal";
import type {
  AiActionSettings,
  AiCallFinish,
  AiCallStart,
  AiLedger,
  AiReservationRequest,
  AiReservationResult,
  AiSettingsSnapshot,
  AiSettlement,
  AiSettlementResult,
  AiUserPolicy,
} from "./ledger";

import {
  core_ai_action_settings,
  core_ai_budget_periods,
  core_ai_calls,
  core_ai_reservations,
  core_ai_role_permissions,
  core_ai_role_policies,
  core_ai_runs,
  core_ai_settings,
  core_ai_user_overrides,
} from "../../../database/ai";
import { core_languages } from "../../../database/languages";
import { core_roles } from "../../../database/roles";
import {
  core_users,
  core_users_secondary_roles,
} from "../../../database/users";
import { PG_ERROR_CODES, pgErrorCode } from "../../../lib/api/pg-error";
import {
  deliveredCostUsd,
  findExceededBudget,
  planBudgetItems,
  settlementCharge,
} from "./budget";
import {
  formatDecimal,
  formatDecimalOrNull,
  maxDecimal,
  parseDecimal,
  parseDecimalOrNull,
  sumDecimals,
} from "./decimal";
import { AI_POINTS_CONVERSION_VERSION, usdToPoints } from "./ledger";

export type AiDatabase = EnvVariablesVitNode["db"];
type Transaction = Parameters<Parameters<AiDatabase["transaction"]>[0]>[0];

const ACTIVE_RUN_STATUSES = ["reserved", "running"] as const;

export const DEFAULT_AI_SETTINGS: Omit<AiSettingsSnapshot, "timeZone"> = {
  altBatchSize: 10,
  altEnabled: false,
  altLanguages: null,
  defaultMonthlyPoints: 0n,
  enabled: true,
  historyRetentionDays: 365,
  monthlyBudgetUsd: null,
  systemConcurrency: 2,
  systemMonthlyBudgetUsd: null,
  userConcurrency: 2,
  userRequestsPerMinute: 10,
};

export class PostgresAiLedger implements AiLedger {
  constructor(db: AiDatabase) {
    this.db = db;
  }

  private readonly db: AiDatabase;

  private async checkThrottles(
    tx: Transaction,
    request: AiReservationRequest,
  ): Promise<AiReservationResult | null> {
    const actorFilter =
      request.actorType === "system"
        ? eq(core_ai_runs.actorType, "system")
        : and(
            eq(core_ai_runs.actorType, "user"),
            eq(core_ai_runs.userId, request.userId ?? -1),
          );

    const [active] = await tx
      .select({ total: count() })
      .from(core_ai_runs)
      .where(
        and(
          actorFilter,
          inArray(core_ai_runs.status, [...ACTIVE_RUN_STATUSES]),
          gt(core_ai_runs.leaseExpiresAt, request.now),
        ),
      );
    const concurrency =
      request.actorType === "system"
        ? request.systemConcurrency
        : request.userConcurrency;
    if (active.total >= concurrency) {
      return { code: "AI_CONCURRENCY_LIMITED", ok: false };
    }

    if (request.actorType === "user") {
      const since = new Date(request.now.getTime() - 60_000);
      const [recent] = await tx
        .select({ total: count() })
        .from(core_ai_runs)
        .where(and(actorFilter, gt(core_ai_runs.createdAt, since)));
      if (recent.total >= request.userRequestsPerMinute) {
        return {
          code: "AI_RATE_LIMITED",
          ok: false,
          resetsAt: new Date(request.now.getTime() + 60_000),
        };
      }
    }

    return null;
  }

  private async findIdempotentRun(
    tx: AiDatabase | Transaction,
    request: AiReservationRequest,
  ): Promise<null | number> {
    if (!request.idempotencyKey) return null;
    const [existing] = await tx
      .select({ id: core_ai_runs.id })
      .from(core_ai_runs)
      .where(
        and(
          eq(core_ai_runs.actorType, request.actorType),
          request.userId === null
            ? sql`${core_ai_runs.userId} IS NULL`
            : eq(core_ai_runs.userId, request.userId),
          eq(core_ai_runs.idempotencyKey, request.idempotencyKey),
        ),
      )
      .limit(1);

    return existing?.id ?? null;
  }

  private async reserveOnce(
    request: AiReservationRequest,
  ): Promise<AiReservationResult> {
    const items = planBudgetItems(request);

    return await this.db.transaction(async tx => {
      if (request.idempotencyKey) {
        const existing = await this.findIdempotentRun(tx, request);
        if (existing) {
          return { code: "AI_DUPLICATE_REQUEST", ok: false, runId: existing };
        }
      }

      for (const item of items) {
        await tx
          .insert(core_ai_budget_periods)
          .values({
            limitAmount: formatDecimalOrNull(item.limit),
            periodEnd: item.period.end,
            periodStart: item.period.start,
            scopeKey: item.scopeKey,
            unit: item.unit,
          })
          .onConflictDoNothing();
      }

      const locked = await tx
        .select()
        .from(core_ai_budget_periods)
        .where(
          or(
            ...items.map(item =>
              and(
                eq(core_ai_budget_periods.scopeKey, item.scopeKey),
                eq(core_ai_budget_periods.periodStart, item.period.start),
              ),
            ),
          ),
        )
        .orderBy(asc(core_ai_budget_periods.scopeKey))
        .for("update");

      const rows = new Map<string, AiBudgetRowState & { id: number }>(
        locked.map(row => [
          row.scopeKey,
          {
            id: row.id,
            limitAmount: parseDecimalOrNull(row.limitAmount),
            periodEnd: row.periodEnd,
            reservedAmount: parseDecimal(row.reservedAmount),
            scopeKey: row.scopeKey,
            spentAmount: parseDecimal(row.spentAmount),
          },
        ]),
      );

      // Rate and concurrency are checked under the actor's own budget lock, so
      // two requests of one user are serialised here and cannot both slip in.
      const rejected = await this.checkThrottles(tx, request);
      if (rejected) return rejected;

      const exceeded = findExceededBudget(items, rows, {
        priced: request.usd !== null,
      });
      if (exceeded) {
        return { code: exceeded.code, ok: false, resetsAt: exceeded.resetsAt };
      }

      const usd = request.usd ?? 0n;
      const [run] = await tx
        .insert(core_ai_runs)
        .values({
          actionKey: request.actionKey,
          actorType: request.actorType,
          idempotencyKey: request.idempotencyKey,
          leaseExpiresAt: new Date(request.now.getTime() + request.leaseMs),
          modelId: request.model.modelId,
          pluginId: request.pluginId,
          pointsConversionVersion: AI_POINTS_CONVERSION_VERSION,
          promptVersion: request.promptVersion,
          provider: request.model.provider,
          providerModelId: request.model.providerModelId,
          reservedPoints:
            request.actorType === "user"
              ? formatDecimal(usdToPoints(usd))
              : "0",
          reservedUsd: formatDecimal(usd),
          resourceId:
            request.resource?.id === null || request.resource?.id === undefined
              ? null
              : String(request.resource.id),
          resourceType: request.resource?.type ?? null,
          sourceFingerprint: request.sourceFingerprint,
          status: "reserved",
          userId: request.userId,
          createdAt: request.now,
        })
        .returning({ id: core_ai_runs.id });

      for (const item of items) {
        const row = rows.get(item.scopeKey);
        if (!row) continue;
        await tx
          .update(core_ai_budget_periods)
          .set({
            limitAmount: formatDecimalOrNull(item.limit),
            reservedAmount: sql`${core_ai_budget_periods.reservedAmount} + ${formatDecimal(item.amount)}`,
          })
          .where(eq(core_ai_budget_periods.id, row.id));
        await tx.insert(core_ai_reservations).values({
          amount: formatDecimal(item.amount),
          budgetPeriodId: row.id,
          runId: run.id,
        });
      }

      return { ok: true, runId: run.id };
    });
  }

  async beginCall(call: AiCallStart): Promise<number> {
    const [row] = await this.db
      .insert(core_ai_calls)
      .values({
        attempt: call.attempt,
        costSource: "unknown",
        costReason: "in flight",
        modelId: call.modelId,
        provider: call.provider,
        providerModelId: call.providerModelId,
        runId: call.runId,
        startedAt: call.startedAt,
        status: "uncertain",
      })
      .returning({ id: core_ai_calls.id });

    return row.id;
  }

  async finishCall(callId: number, call: AiCallFinish): Promise<void> {
    await this.db
      .update(core_ai_calls)
      .set({
        cacheReadTokens: call.usage.cacheReadTokens,
        cacheWriteTokens: call.usage.cacheWriteTokens,
        costReason: call.cost.source === "unknown" ? call.cost.reason : null,
        costSource: call.cost.source,
        costUsd: call.cost.amountUsd,
        errorCode: call.errorCode,
        finishedAt: call.finishedAt,
        images: call.images,
        inputTokens: call.usage.inputTokens,
        outputTokens: call.usage.outputTokens,
        pricingSnapshot: call.pricingSnapshot,
        pricingVersion:
          call.cost.source === "pricing" ? call.cost.pricingVersion : null,
        providerModelId: call.providerModelId ?? undefined,
        providerRequestId: call.providerRequestId,
        reasoningTokens: call.usage.reasoningTokens,
        status: call.status,
      })
      .where(eq(core_ai_calls.id, callId));
  }

  async loadActionSettings(
    actionKey: string,
  ): Promise<AiActionSettings | null> {
    const [row] = await this.db
      .select()
      .from(core_ai_action_settings)
      .where(eq(core_ai_action_settings.actionKey, actionKey))
      .limit(1);
    if (!row) return null;

    return {
      dailyLimit: row.dailyLimit,
      enabled: row.enabled,
      fallbackModelId: row.fallbackModelId,
      instructions: row.instructions,
      maxInputCharacters: row.maxInputCharacters,
      maxOutputTokens: row.maxOutputTokens,
      maxRetries: row.maxRetries,
      maxSteps: row.maxSteps,
      modelId: row.modelId,
      timeoutMs: row.timeoutMs,
    };
  }

  async loadSettings(): Promise<AiSettingsSnapshot> {
    const [[row], [language]] = await Promise.all([
      this.db.select().from(core_ai_settings).where(eq(core_ai_settings.id, 1)),
      this.db
        .select({ timezone: core_languages.timezone })
        .from(core_languages)
        .where(eq(core_languages.default, true))
        .limit(1),
    ]);
    const timeZone = language?.timezone ?? "UTC";
    if (!row) return { ...DEFAULT_AI_SETTINGS, timeZone };

    return {
      altBatchSize: row.altBatchSize,
      altEnabled: row.altEnabled,
      altLanguages: row.altLanguages ?? null,
      defaultMonthlyPoints: parseDecimal(row.defaultMonthlyPoints),
      enabled: row.enabled,
      historyRetentionDays: row.historyRetentionDays,
      monthlyBudgetUsd: parseDecimalOrNull(row.monthlyBudgetUsd),
      systemConcurrency: row.systemConcurrency,
      systemMonthlyBudgetUsd: parseDecimalOrNull(row.systemMonthlyBudgetUsd),
      timeZone,
      userConcurrency: row.userConcurrency,
      userRequestsPerMinute: row.userRequestsPerMinute,
    };
  }

  async markRunning(runId: number, leaseExpiresAt: Date): Promise<void> {
    await this.db
      .update(core_ai_runs)
      .set({ leaseExpiresAt, startedAt: new Date(), status: "running" })
      .where(
        and(eq(core_ai_runs.id, runId), eq(core_ai_runs.status, "reserved")),
      );
  }

  /**
   * One short transaction: make sure every budget row exists, lock them all in
   * `scopeKey` order, check rate, concurrency and every cap, then write the
   * run and its holds. Nothing slow happens while the locks are held.
   */
  async reserve(request: AiReservationRequest): Promise<AiReservationResult> {
    try {
      return await this.reserveOnce(request);
    } catch (error) {
      // Two submissions with one idempotency key raced past the lookup: the
      // unique index let exactly one in. The other is a duplicate, not a failure.
      if (
        request.idempotencyKey &&
        pgErrorCode(error) === PG_ERROR_CODES.uniqueViolation
      ) {
        const existing = await this.findIdempotentRun(this.db, request);
        if (existing) {
          return { code: "AI_DUPLICATE_REQUEST", ok: false, runId: existing };
        }
      }
      throw error;
    }
  }

  async resolveUserPolicy({
    defaultGranted,
    permissionKey,
    userId,
  }: {
    defaultGranted: boolean;
    permissionKey: string;
    userId: number;
  }): Promise<AiUserPolicy> {
    const [user] = await this.db
      .select({ roleId: core_users.roleId })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);
    if (!user) return { dailyLimit: null, granted: false, monthlyPoints: 0n };

    const secondary = await this.db
      .select({ roleId: core_users_secondary_roles.roleId })
      .from(core_users_secondary_roles)
      .where(eq(core_users_secondary_roles.userId, userId));
    const roleIds = [
      ...new Set([user.roleId, ...secondary.map(r => r.roleId)]),
    ];

    const [roles, permissions, policies, [override], settings] =
      await Promise.all([
        this.db
          .select({ id: core_roles.id, root: core_roles.root })
          .from(core_roles)
          .where(inArray(core_roles.id, roleIds)),
        this.db
          .select()
          .from(core_ai_role_permissions)
          .where(
            and(
              inArray(core_ai_role_permissions.roleId, roleIds),
              eq(core_ai_role_permissions.permission, permissionKey),
            ),
          ),
        this.db
          .select()
          .from(core_ai_role_policies)
          .where(inArray(core_ai_role_policies.roleId, roleIds)),
        this.db
          .select()
          .from(core_ai_user_overrides)
          .where(eq(core_ai_user_overrides.userId, userId))
          .limit(1),
        this.loadSettings(),
      ]);

    return resolvePolicy({
      defaultGranted,
      defaultMonthlyPoints: settings.defaultMonthlyPoints,
      override: override
        ? {
            blocked: override.blocked,
            monthlyPoints: parseDecimalOrNull(override.monthlyPoints),
            unlimited: override.unlimited,
          }
        : null,
      permissions: permissions.map(row => ({
        dailyLimit: row.dailyLimit,
        granted: row.granted,
      })),
      policies: policies.map(row => ({
        monthlyPoints: parseDecimalOrNull(row.monthlyPoints),
        unlimited: row.unlimited,
      })),
      root: roles.some(role => role.root),
    });
  }

  /**
   * Idempotent by construction: the run's `settlement` flips from `pending`
   * exactly once, under the row lock, and only that transaction moves money.
   */
  async settle(
    runId: number,
    settlement: AiSettlement,
  ): Promise<AiSettlementResult> {
    return await this.db.transaction(async tx => {
      const [run] = await tx
        .select()
        .from(core_ai_runs)
        .where(eq(core_ai_runs.id, runId))
        .for("update");
      if (run?.settlement !== "pending") {
        return {
          applied: false,
          chargedPoints: parseDecimalOrNull(run?.chargedPoints ?? null) ?? 0n,
          chargedUsd: parseDecimalOrNull(run?.chargedUsd ?? null) ?? 0n,
          costKnown: run?.costUsd !== null && run?.costUsd !== undefined,
        };
      }

      const calls = await tx
        .select()
        .from(core_ai_calls)
        .where(eq(core_ai_calls.runId, runId));
      const totals = summarizeCalls(calls);
      const reservedUsd = parseDecimal(run.reservedUsd);
      // Unknown is never free: an unknown cost is charged the whole hold.
      const chargedUsd =
        totals.costUsd ?? maxDecimal(reservedUsd, totals.knownUsd);

      const holds = await tx
        .select({
          amount: core_ai_reservations.amount,
          budgetPeriodId: core_ai_reservations.budgetPeriodId,
          id: core_ai_reservations.id,
          scopeKey: core_ai_budget_periods.scopeKey,
          unit: core_ai_budget_periods.unit,
        })
        .from(core_ai_reservations)
        .innerJoin(
          core_ai_budget_periods,
          eq(core_ai_budget_periods.id, core_ai_reservations.budgetPeriodId),
        )
        .where(
          and(
            eq(core_ai_reservations.runId, runId),
            eq(core_ai_reservations.status, "active"),
          ),
        )
        .orderBy(asc(core_ai_budget_periods.scopeKey));

      if (holds.length > 0) {
        await tx
          .select({ id: core_ai_budget_periods.id })
          .from(core_ai_budget_periods)
          .where(
            inArray(
              core_ai_budget_periods.id,
              holds.map(hold => hold.budgetPeriodId),
            ),
          )
          .orderBy(asc(core_ai_budget_periods.scopeKey))
          .for("update");
      }

      let chargedPoints = 0n;
      for (const hold of holds) {
        const charge = settlementCharge({
          chargedUsd,
          deliveredUsd: deliveredCostUsd(
            calls.map(call => ({
              costUsd: parseDecimalOrNull(call.costUsd),
              status: call.status,
            })),
            reservedUsd,
          ),
          delivered: settlement.delivered,
          unit: hold.unit,
        });
        if (hold.unit === "points") chargedPoints = charge;
        await tx
          .update(core_ai_budget_periods)
          .set({
            reservedAmount: sql`${core_ai_budget_periods.reservedAmount} - ${hold.amount}`,
            spentAmount: sql`${core_ai_budget_periods.spentAmount} + ${formatDecimal(charge)}`,
            unknownCount:
              totals.costUsd === null && hold.unit === "usd"
                ? sql`${core_ai_budget_periods.unknownCount} + 1`
                : undefined,
          })
          .where(eq(core_ai_budget_periods.id, hold.budgetPeriodId));
      }
      if (holds.length > 0) {
        await tx
          .update(core_ai_reservations)
          .set({ settledAt: settlement.finishedAt, status: "settled" })
          .where(
            inArray(
              core_ai_reservations.id,
              holds.map(hold => hold.id),
            ),
          );
      }

      await tx
        .update(core_ai_runs)
        .set({
          ...totals.usage,
          chargedPoints: formatDecimal(chargedPoints),
          chargedUsd: formatDecimal(chargedUsd),
          costSource: totals.source,
          costUsd: formatDecimalOrNull(totals.costUsd),
          errorCode: settlement.errorCode,
          finishedAt: settlement.finishedAt,
          leaseExpiresAt: null,
          providerModelId: totals.providerModelId ?? run.providerModelId,
          settledAt: settlement.finishedAt,
          settlement: "settled",
          status: settlement.status,
        })
        .where(eq(core_ai_runs.id, runId));

      return {
        applied: true,
        chargedPoints,
        chargedUsd,
        costKnown: totals.costUsd !== null,
      };
    });
  }
}

interface PolicyInputs {
  defaultGranted: boolean;
  defaultMonthlyPoints: Decimal;
  override: null | {
    blocked: boolean;
    monthlyPoints: Decimal | null;
    unlimited: boolean;
  };
  permissions: { dailyLimit: null | number; granted: boolean }[];
  policies: { monthlyPoints: Decimal | null; unlimited: boolean }[];
  root: boolean;
}

/**
 * Multiple roles, existing semantics: any role that grants, grants. Allowances
 * are individual: the largest one applies - they are never summed into a pool.
 * An explicit user override replaces whatever the roles give.
 */
export const resolvePolicy = ({
  defaultGranted,
  defaultMonthlyPoints,
  override,
  permissions,
  policies,
  root,
}: PolicyInputs): AiUserPolicy => {
  if (override?.blocked) {
    return { dailyLimit: null, granted: false, monthlyPoints: 0n };
  }

  const granting = permissions.filter(row => row.granted);
  const granted =
    root || (permissions.length === 0 ? defaultGranted : granting.length > 0);
  const dailyLimit =
    root ||
    granting.length === 0 ||
    granting.some(row => row.dailyLimit === null)
      ? null
      : Math.max(...granting.map(row => row.dailyLimit ?? 0));

  let monthlyPoints: Decimal | null;
  if (override?.unlimited) {
    monthlyPoints = null;
  } else if (
    override?.monthlyPoints !== null &&
    override?.monthlyPoints !== undefined
  ) {
    monthlyPoints = override.monthlyPoints;
  } else if (root || policies.some(policy => policy.unlimited)) {
    monthlyPoints = null;
  } else {
    monthlyPoints = policies
      .map(policy => policy.monthlyPoints ?? defaultMonthlyPoints)
      .reduce(maxDecimal, defaultMonthlyPoints);
  }

  return { dailyLimit, granted, monthlyPoints };
};

type CallRow = typeof core_ai_calls.$inferSelect;

/** Sums a run's calls once. A run is "known" only when every call is. */
export const summarizeCalls = (calls: CallRow[]) => {
  const sumOf = (pick: (call: CallRow) => null | number) => {
    const values = calls.map(pick);

    return values.every(value => value === null)
      ? null
      : values.reduce<number>((total, value) => total + (value ?? 0), 0);
  };
  const costs = calls.map(call => parseDecimalOrNull(call.costUsd));
  const allKnown = calls.length > 0 && costs.every(cost => cost !== null);
  const sources = new Set(calls.map(call => call.costSource));
  let source: "mixed" | "pricing" | "provider" | "unknown";
  if (!allKnown) source = "unknown";
  else if (sources.size === 1) source = [...sources][0];
  else source = "mixed";

  const last = calls.at(-1);

  return {
    costUsd: calls.length === 0 ? 0n : allKnown ? sumDecimals(costs) : null,
    knownUsd: sumDecimals(
      costs.filter((cost): cost is Decimal => cost !== null),
    ),
    providerModelId: last?.providerModelId ?? null,
    source: calls.length === 0 ? ("pricing" as const) : source,
    usage: {
      cacheReadTokens: sumOf(call => call.cacheReadTokens),
      cacheWriteTokens: sumOf(call => call.cacheWriteTokens),
      inputTokens: sumOf(call => call.inputTokens),
      outputTokens: sumOf(call => call.outputTokens),
      reasoningTokens: sumOf(call => call.reasoningTokens),
    },
  };
};
