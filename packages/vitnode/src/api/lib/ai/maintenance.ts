import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import type { AIModelDefinition } from "../../models/ai";
import type { Decimal } from "./decimal";
import type { AiDatabase } from "./postgres-ledger";
import type { AiPricing } from "./pricing";
import type { AiProviderAdapter } from "./usage-cost";

import {
  core_ai_budget_periods,
  core_ai_calls,
  core_ai_cost_adjustments,
  core_ai_pricing,
  core_ai_reservations,
  core_ai_runs,
} from "../../../database/ai";
import {
  formatDecimal,
  formatDecimalOrNull,
  multiplyByInteger,
  parseDecimal,
  parseDecimalOrNull,
} from "./decimal";
import { usdToPoints } from "./ledger";
import { PostgresAiLedger, summarizeCalls } from "./postgres-ledger";
import { resolveProviderAdapter } from "./usage-cost";

/**
 * Runs whose execution lease expired - the process died mid-call - become
 * `uncertain`. Their holds are settled as unknown cost: the site is charged
 * the whole reservation, because the provider may have billed work nobody
 * saw. The user is charged nothing - no result reached them.
 */
export const expireAiLeases = async (
  db: AiDatabase,
  now = new Date(),
): Promise<number> => {
  const expired = await db
    .select({ id: core_ai_runs.id })
    .from(core_ai_runs)
    .where(
      and(
        inArray(core_ai_runs.status, ["reserved", "running"]),
        eq(core_ai_runs.settlement, "pending"),
        lt(core_ai_runs.leaseExpiresAt, now),
      ),
    )
    .limit(100);

  const ledger = new PostgresAiLedger(db);
  for (const run of expired) {
    await ledger.settle(run.id, {
      delivered: false,
      errorCode: "AI_TIMEOUT",
      finishedAt: now,
      status: "uncertain",
    });
  }

  return expired.length;
};

/**
 * Replaces an estimated or unknown cost with the amount the provider billed,
 * once, with an audit row. The budgets move by the difference - the earlier
 * charge is corrected, never counted twice.
 */
export const applyAiCostAdjustment = async (
  db: AiDatabase,
  {
    billedUsd,
    callId,
    reason,
  }: { billedUsd: Decimal; callId: number; reason: string },
): Promise<boolean> =>
  await db.transaction(async tx => {
    const [call] = await tx
      .select()
      .from(core_ai_calls)
      .where(eq(core_ai_calls.id, callId))
      .for("update");
    if (!call || call.costSource === "provider") return false;

    const [run] = await tx
      .select()
      .from(core_ai_runs)
      .where(eq(core_ai_runs.id, call.runId))
      .for("update");
    if (!run) return false;

    const inserted = await tx
      .insert(core_ai_cost_adjustments)
      .values({
        callId,
        deltaUsd: "0",
        newCostUsd: formatDecimal(billedUsd),
        newSource: "provider",
        previousCostUsd: call.costUsd,
        previousSource: call.costSource,
        reason,
        runId: run.id,
      })
      .onConflictDoNothing()
      .returning({ id: core_ai_cost_adjustments.id });
    if (inserted.length === 0) return false;

    await tx
      .update(core_ai_calls)
      .set({
        costReason: null,
        costSource: "provider",
        costUsd: formatDecimal(billedUsd),
        reconciledAt: new Date(),
        status: call.status === "uncertain" ? "succeeded" : call.status,
      })
      .where(eq(core_ai_calls.id, callId));

    const calls = await tx
      .select()
      .from(core_ai_calls)
      .where(eq(core_ai_calls.runId, run.id));
    const totals = summarizeCalls(calls);

    // Only a settled run has charged anything; a pending one settles later
    // from the corrected call, so its delta is zero now.
    if (run.settlement !== "settled" || totals.costUsd === null) {
      await tx
        .update(core_ai_runs)
        .set({
          costSource: totals.source,
          costUsd: formatDecimalOrNull(totals.costUsd),
        })
        .where(eq(core_ai_runs.id, run.id));

      return true;
    }

    const previousCharge = parseDecimalOrNull(run.chargedUsd) ?? 0n;
    const delta = totals.costUsd - previousCharge;
    const delivered = run.actorType === "user" && run.status === "succeeded";
    const pointsDelta = delivered ? usdToPoints(delta) : 0n;

    const holds = await tx
      .select({
        budgetPeriodId: core_ai_reservations.budgetPeriodId,
        unit: core_ai_budget_periods.unit,
      })
      .from(core_ai_reservations)
      .innerJoin(
        core_ai_budget_periods,
        eq(core_ai_budget_periods.id, core_ai_reservations.budgetPeriodId),
      )
      .where(eq(core_ai_reservations.runId, run.id))
      .orderBy(asc(core_ai_budget_periods.scopeKey));
    for (const hold of holds) {
      const change =
        hold.unit === "usd" ? delta : hold.unit === "points" ? pointsDelta : 0n;
      if (change === 0n) continue;
      await tx
        .update(core_ai_budget_periods)
        .set({
          spentAmount: sql`${core_ai_budget_periods.spentAmount} + ${formatDecimal(change)}`,
          unknownCount:
            run.costUsd === null && hold.unit === "usd"
              ? sql`GREATEST(${core_ai_budget_periods.unknownCount} - 1, 0)`
              : undefined,
        })
        .where(eq(core_ai_budget_periods.id, hold.budgetPeriodId));
    }

    await tx
      .update(core_ai_cost_adjustments)
      .set({ deltaUsd: formatDecimal(delta) })
      .where(eq(core_ai_cost_adjustments.id, inserted[0].id));
    await tx
      .update(core_ai_runs)
      .set({
        chargedPoints: formatDecimal(
          parseDecimal(run.chargedPoints ?? "0") + pointsDelta,
        ),
        chargedUsd: formatDecimal(totals.costUsd),
        costSource: totals.source,
        costUsd: formatDecimal(totals.costUsd),
      })
      .where(eq(core_ai_runs.id, run.id));

    return true;
  });

/**
 * Asks providers that report billed cost out of band (the AI Gateway) for
 * the real amount of recent estimated or unknown calls.
 */
export const reconcileAiCosts = async (
  db: AiDatabase,
  adapters: AiProviderAdapter[],
  { limit = 50, now = new Date() }: { limit?: number; now?: Date } = {},
): Promise<number> => {
  const candidates = await db
    .select({
      id: core_ai_calls.id,
      provider: core_ai_calls.provider,
      providerRequestId: core_ai_calls.providerRequestId,
    })
    .from(core_ai_calls)
    .where(
      and(
        inArray(core_ai_calls.costSource, ["manual", "pricing", "unknown"]),
        isNotNull(core_ai_calls.providerRequestId),
        isNull(core_ai_calls.reconciledAt),
        lt(core_ai_calls.startedAt, new Date(now.getTime() - 60_000)),
        gt(core_ai_calls.startedAt, new Date(now.getTime() - 7 * 86_400_000)),
      ),
    )
    .limit(limit);

  let adjusted = 0;
  for (const call of candidates) {
    const adapter = resolveProviderAdapter(adapters, call.provider);
    if (!adapter.lookupCost || !call.providerRequestId) continue;

    let billed: Decimal | null;
    try {
      billed = await adapter.lookupCost(call.providerRequestId);
    } catch {
      continue;
    }
    if (billed !== null) {
      const applied = await applyAiCostAdjustment(db, {
        billedUsd: billed,
        callId: call.id,
        reason: `${adapter.id} reported the billed cost`,
      });
      if (applied) adjusted += 1;
    } else {
      await db
        .update(core_ai_calls)
        .set({ reconciledAt: now })
        .where(eq(core_ai_calls.id, call.id));
    }
  }

  return adjusted;
};

/** History is kept on its own schedule, never tied to the queue's cleanup. */
export const pruneAiHistory = async (
  db: AiDatabase,
  retentionDays: number,
  now = new Date(),
): Promise<void> => {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  await db
    .delete(core_ai_runs)
    .where(
      and(
        lt(core_ai_runs.createdAt, cutoff),
        eq(core_ai_runs.settlement, "settled"),
      ),
    );
  await db
    .delete(core_ai_budget_periods)
    .where(
      and(
        lt(core_ai_budget_periods.periodEnd, cutoff),
        eq(core_ai_budget_periods.reservedAmount, "0"),
      ),
    );
};

/** A gateway catalog entry's per-token prices, as VitNode pricing. */
export const pricingFromGatewayEntry = (entry: {
  cacheCreationInputTokens?: string;
  cachedInputTokens?: string;
  input: string;
  output: string;
}): AiPricing => {
  const perMillion = (perToken: string) =>
    formatDecimal(multiplyByInteger(parseDecimal(perToken), 1_000_000));

  return {
    rates: {
      inputPerMillion: perMillion(entry.input),
      outputPerMillion: perMillion(entry.output),
      ...(entry.cachedInputTokens
        ? { cacheReadPerMillion: perMillion(entry.cachedInputTokens) }
        : {}),
      ...(entry.cacheCreationInputTokens
        ? { cacheWritePerMillion: perMillion(entry.cacheCreationInputTokens) }
        : {}),
    },
  };
};

export type GatewayCatalogFetcher = () => Promise<{
  models: {
    id: string;
    pricing?: null | {
      cacheCreationInputTokens?: string;
      cachedInputTokens?: string;
      input: string;
      output: string;
    };
  }[];
}>;

/**
 * Copies the AI Gateway's published prices onto gateway models only - a
 * direct provider connection is never priced from the gateway catalog. A
 * changed price becomes a new version; the old one stays for history.
 */
export const syncGatewayPricing = async (
  db: AiDatabase,
  models: AIModelDefinition[],
  fetchCatalog: GatewayCatalogFetcher,
): Promise<{ unchanged: string[]; unpriced: string[]; updated: string[] }> => {
  const gatewayModels = models.filter(entry => typeof entry.model === "string");
  const result = {
    unchanged: [] as string[],
    unpriced: [] as string[],
    updated: [] as string[],
  };
  if (gatewayModels.length === 0) return result;

  const catalog = await fetchCatalog();
  for (const entry of gatewayModels) {
    const listed = catalog.models.find(model => model.id === entry.model);
    if (!listed?.pricing) {
      result.unpriced.push(entry.id);
      continue;
    }
    const pricing = pricingFromGatewayEntry(listed.pricing);
    const changed = await db.transaction(async tx => {
      const [current] = await tx
        .select()
        .from(core_ai_pricing)
        .where(
          and(
            eq(core_ai_pricing.modelId, entry.id),
            eq(core_ai_pricing.source, "sync"),
            eq(core_ai_pricing.active, true),
          ),
        )
        .for("update");
      if (
        current &&
        JSON.stringify(current.pricing) === JSON.stringify(pricing)
      ) {
        return false;
      }
      if (current) {
        await tx
          .update(core_ai_pricing)
          .set({ active: false })
          .where(eq(core_ai_pricing.id, current.id));
      }
      await tx
        .insert(core_ai_pricing)
        .values({ modelId: entry.id, pricing, source: "sync" });

      return true;
    });
    (changed ? result.updated : result.unchanged).push(entry.id);
  }

  return result;
};
