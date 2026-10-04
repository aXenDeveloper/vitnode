import type { AiBudgetRowState, AiBudgetUnit } from "./budget";
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
  AiStoredPricing,
  AiUserPolicy,
} from "./ledger";

import {
  deliveredCostUsd,
  findExceededBudget,
  planBudgetItems,
  settlementCharge,
} from "./budget";
import { maxDecimal, parseDecimalOrNull, sumDecimals } from "./decimal";
import { DEFAULT_AI_SETTINGS } from "./postgres-ledger";

export interface MemoryAiRun {
  actionKey: string;
  actorType: "system" | "user";
  chargedPoints: Decimal | null;
  chargedUsd: Decimal | null;
  createdAt: Date;
  errorCode: null | string;
  id: number;
  idempotencyKey: null | string;
  leaseExpiresAt: Date | null;
  reservedUsd: Decimal;
  settled: boolean;
  status: string;
  userId: null | number;
}

export interface MemoryAiCall extends AiCallStart {
  finish?: AiCallFinish;
  id: number;
}

/**
 * An in-process ledger with the same budget rules as the Postgres one. It is a
 * seam for route and runner tests - it proves behaviour, not concurrency. The
 * concurrency guarantees are proven against PostgreSQL itself.
 */
export class MemoryAiLedger implements AiLedger {
  constructor({
    actionSettings = {},
    policy = () => ({ dailyLimit: null, granted: true, monthlyPoints: null }),
    pricing = {},
    settings = {},
  }: {
    actionSettings?: Record<string, Partial<AiActionSettings>>;
    policy?: (args: { permissionKey: string; userId: number }) => AiUserPolicy;
    pricing?: Record<string, Partial<AiStoredPricing>>;
    settings?: Partial<AiSettingsSnapshot>;
  } = {}) {
    this.actionSettings = actionSettings;
    this.policy = policy;
    this.pricing = pricing;
    this.settings = { ...DEFAULT_AI_SETTINGS, timeZone: "UTC", ...settings };
  }

  private readonly actionSettings: Record<string, Partial<AiActionSettings>>;
  private readonly holds = new Map<
    number,
    { amount: Decimal; key: string; unit: AiBudgetUnit }[]
  >();
  private readonly policy: (args: {
    permissionKey: string;
    userId: number;
  }) => AiUserPolicy;
  private readonly pricing: Record<string, Partial<AiStoredPricing>>;
  readonly budgets = new Map<
    string,
    AiBudgetRowState & { unit: AiBudgetUnit; unknownCount: number }
  >();
  readonly calls: MemoryAiCall[] = [];
  readonly runs: MemoryAiRun[] = [];
  settings: AiSettingsSnapshot;

  async beginCall(call: AiCallStart): Promise<number> {
    const id = this.calls.length + 1;
    this.calls.push({ ...call, id });

    return Promise.resolve(id);
  }

  async finishCall(callId: number, call: AiCallFinish): Promise<void> {
    const entry = this.calls.find(item => item.id === callId);
    if (entry) entry.finish = call;

    return Promise.resolve();
  }

  async loadActionSettings(
    actionKey: string,
  ): Promise<AiActionSettings | null> {
    const partial = this.actionSettings[actionKey];
    if (!partial) return Promise.resolve(null);

    return Promise.resolve({
      dailyLimit: null,
      enabled: true,
      fallbackModelId: null,
      instructions: null,
      maxInputCharacters: null,
      maxOutputTokens: null,
      maxRetries: null,
      maxSteps: null,
      modelId: null,
      timeoutMs: null,
      ...partial,
    });
  }

  async loadPricing(modelId: string): Promise<AiStoredPricing> {
    return Promise.resolve({
      manual: null,
      sync: null,
      ...this.pricing[modelId],
    });
  }

  async loadSettings(): Promise<AiSettingsSnapshot> {
    return Promise.resolve(this.settings);
  }

  async markRunning(runId: number, leaseExpiresAt: Date): Promise<void> {
    const run = this.runs.find(item => item.id === runId);
    if (run?.status === "reserved") {
      run.status = "running";
      run.leaseExpiresAt = leaseExpiresAt;
    }

    return Promise.resolve();
  }

  async reserve(request: AiReservationRequest): Promise<AiReservationResult> {
    if (request.idempotencyKey) {
      const existing = this.runs.find(
        run =>
          run.actorType === request.actorType &&
          run.userId === request.userId &&
          run.idempotencyKey === request.idempotencyKey,
      );
      if (existing) {
        return Promise.resolve({
          code: "AI_DUPLICATE_REQUEST",
          ok: false,
          runId: existing.id,
        });
      }
    }

    const items = planBudgetItems(request);
    const rowKey = (scopeKey: string, start: Date) =>
      `${scopeKey}@${start.toISOString()}`;
    const rows = new Map<string, AiBudgetRowState>();
    for (const item of items) {
      const key = rowKey(item.scopeKey, item.period.start);
      const row = this.budgets.get(key) ?? {
        limitAmount: item.limit,
        periodEnd: item.period.end,
        reservedAmount: 0n,
        scopeKey: item.scopeKey,
        spentAmount: 0n,
        unit: item.unit,
        unknownCount: 0,
      };
      this.budgets.set(key, row);
      rows.set(item.scopeKey, row);
    }

    const mine = this.runs.filter(run =>
      request.actorType === "system"
        ? run.actorType === "system"
        : run.actorType === "user" && run.userId === request.userId,
    );
    const active = mine.filter(
      run =>
        (run.status === "reserved" || run.status === "running") &&
        (run.leaseExpiresAt?.getTime() ?? 0) > request.now.getTime(),
    ).length;
    const concurrency =
      request.actorType === "system"
        ? request.systemConcurrency
        : request.userConcurrency;
    if (active >= concurrency) {
      return Promise.resolve({ code: "AI_CONCURRENCY_LIMITED", ok: false });
    }
    if (request.actorType === "user") {
      const since = request.now.getTime() - 60_000;
      const recent = mine.filter(run => run.createdAt.getTime() > since).length;
      if (recent >= request.userRequestsPerMinute) {
        return Promise.resolve({
          code: "AI_RATE_LIMITED",
          ok: false,
          resetsAt: new Date(request.now.getTime() + 60_000),
        });
      }
    }

    const exceeded = findExceededBudget(items, rows, {
      priced: request.usd !== null,
    });
    if (exceeded) {
      return Promise.resolve({
        code: exceeded.code,
        ok: false,
        resetsAt: exceeded.resetsAt,
      });
    }

    const id = this.runs.length + 1;
    this.runs.push({
      actionKey: request.actionKey,
      actorType: request.actorType,
      chargedPoints: null,
      chargedUsd: null,
      createdAt: request.now,
      errorCode: null,
      id,
      idempotencyKey: request.idempotencyKey,
      leaseExpiresAt: new Date(request.now.getTime() + request.leaseMs),
      reservedUsd: request.usd ?? 0n,
      settled: false,
      status: "reserved",
      userId: request.userId,
    });
    const holds = items.map(item => {
      const row = rows.get(item.scopeKey);
      if (row) {
        row.limitAmount = item.limit;
        row.reservedAmount += item.amount;
      }

      return {
        amount: item.amount,
        key: rowKey(item.scopeKey, item.period.start),
        unit: item.unit,
      };
    });
    this.holds.set(id, holds);

    return Promise.resolve({ ok: true, runId: id });
  }

  async resolveUserPolicy({
    permissionKey,
    userId,
  }: {
    defaultGranted: boolean;
    permissionKey: string;
    userId: number;
  }): Promise<AiUserPolicy> {
    return Promise.resolve(this.policy({ permissionKey, userId }));
  }

  async settle(
    runId: number,
    settlement: AiSettlement,
  ): Promise<AiSettlementResult> {
    const run = this.runs.find(item => item.id === runId);
    if (!run || run.settled) {
      return Promise.resolve({
        applied: false,
        chargedPoints: run?.chargedPoints ?? 0n,
        chargedUsd: run?.chargedUsd ?? 0n,
        costKnown: true,
      });
    }

    const runCalls = this.calls.filter(call => call.runId === runId);
    const costs = runCalls.map(call =>
      parseDecimalOrNull(call.finish?.cost.amountUsd ?? null),
    );
    const deliveredUsd = deliveredCostUsd(
      runCalls.map(call => ({
        costUsd: parseDecimalOrNull(call.finish?.cost.amountUsd ?? null),
        status: call.finish?.status ?? "uncertain",
      })),
      run.reservedUsd,
    );
    const known = costs.every(cost => cost !== null);
    const knownUsd = sumDecimals(costs.filter((c): c is Decimal => c !== null));
    const chargedUsd = known ? knownUsd : maxDecimal(run.reservedUsd, knownUsd);

    let chargedPoints = 0n;
    for (const hold of this.holds.get(runId) ?? []) {
      const row = this.budgets.get(hold.key);
      if (!row) continue;
      const charge = settlementCharge({
        chargedUsd,
        deliveredUsd,
        delivered: settlement.delivered,
        unit: hold.unit,
      });
      if (hold.unit === "points") chargedPoints = charge;
      row.reservedAmount -= hold.amount;
      row.spentAmount += charge;
      if (!known && hold.unit === "usd") row.unknownCount += 1;
    }

    run.settled = true;
    run.status = settlement.status;
    run.errorCode = settlement.errorCode;
    run.chargedUsd = chargedUsd;
    run.chargedPoints = chargedPoints;
    run.leaseExpiresAt = null;

    return Promise.resolve({
      applied: true,
      chargedPoints,
      chargedUsd,
      costKnown: known,
    });
  }

  /** Points a user has spent this month, for assertions. */
  spentPoints(userId: number): Decimal {
    return sumDecimals(
      [...this.budgets.values()]
        .filter(row => row.scopeKey === `user:${userId}`)
        .map(row => row.spentAmount),
    );
  }

  /** USD the site has spent this month, for assertions. */
  spentUsd(scopeKey = "global"): Decimal {
    return sumDecimals(
      [...this.budgets.values()]
        .filter(row => row.scopeKey === scopeKey)
        .map(row => row.spentAmount),
    );
  }
}
