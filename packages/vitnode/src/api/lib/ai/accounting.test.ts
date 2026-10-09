// @vitest-environment node
import type { LanguageModelUsage } from "ai";

import { describe, expect, it } from "vitest";

import type { AiPricing } from "./pricing";

import {
  findExceededBudget,
  planBudgetItems,
  settlementCharge,
} from "./budget";
import {
  decimalFromNumber,
  formatDecimal,
  parseDecimal,
  sumDecimals,
} from "./decimal";
import { usdToPoints } from "./ledger";
import { periodContaining } from "./periods";
import { resolvePolicy } from "./postgres-ledger";
import { assertAiModelPricing, maxCallCost, priceUsage } from "./pricing";
import {
  defaultProviderAdapter,
  gatewayProviderAdapter,
  normalizeUsage,
  openRouterProviderAdapter,
  resolveCost,
  resolveProviderAdapter,
} from "./usage-cost";

const usd = (value: string) => parseDecimal(value);

const SONNET: AiPricing = {
  rates: {
    cacheReadPerMillion: "0.30",
    cacheWritePerMillion: "3.75",
    inputPerMillion: "3",
    outputPerMillion: "15",
  },
  tiers: [
    {
      aboveInputTokens: 200_000,
      rates: { inputPerMillion: "6", outputPerMillion: "22.5" },
    },
  ],
};

const usage = (
  overrides: Partial<{
    cacheReadTokens: null | number;
    cacheWriteTokens: null | number;
    inputTokens: null | number;
    outputTokens: null | number;
    reasoningTokens: null | number;
  }> = {},
) => ({
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  inputTokens: 1_000,
  outputTokens: 100,
  reasoningTokens: null,
  ...overrides,
});

describe("decimal money", () => {
  it("adds sub-cent amounts without float drift", () => {
    const total = sumDecimals(Array.from({ length: 10 }, () => usd("0.1")));

    expect(formatDecimal(total)).toBe("1");
    expect(formatDecimal(sumDecimals([usd("0.1"), usd("0.2")]))).toBe("0.3");
  });

  it("reads provider floats through their decimal text", () => {
    expect(formatDecimal(decimalFromNumber(0.000123))).toBe("0.000123");
  });

  it("converts USD to points at 1 point = 0.001 USD, keeping precision", () => {
    expect(formatDecimal(usdToPoints(usd("0.0003")))).toBe("0.3");
    expect(formatDecimal(usdToPoints(usd("0.003")))).toBe("3");
    expect(formatDecimal(usdToPoints(usd("0.012")))).toBe("12");
    expect(formatDecimal(usdToPoints(usd("0.0000001")))).toBe("0.0001");
  });
});

describe("pricing", () => {
  it("prices uncached input, cache reads, cache writes and output separately", () => {
    const result = priceUsage(
      SONNET,
      usage({
        cacheReadTokens: 2_000,
        cacheWriteTokens: 1_000,
        inputTokens: 10_000,
        outputTokens: 500,
      }),
    );

    expect(result).toEqual({ amount: usd("0.03285"), status: "complete" });
  });

  it("never bills reasoning tokens on top of output tokens", () => {
    const withReasoning = priceUsage(
      SONNET,
      usage({ outputTokens: 1_000, reasoningTokens: 800 }),
    );
    const without = priceUsage(SONNET, usage({ outputTokens: 1_000 }));

    expect(withReasoning).toEqual(without);
  });

  it("bills the whole call at the long-context tier above its threshold", () => {
    const result = priceUsage(
      SONNET,
      usage({ inputTokens: 300_000, outputTokens: 1_000 }),
    );

    expect(result).toEqual({ amount: usd("1.8225"), status: "complete" });
  });

  it("refuses to call an incomplete price exact", () => {
    const noCachePrice: AiPricing = {
      rates: { inputPerMillion: "1", outputPerMillion: "2" },
    };

    expect(priceUsage(noCachePrice, usage({ cacheReadTokens: 10 }))).toEqual({
      reason: "no cache read price",
      status: "incomplete",
    });
    expect(priceUsage(SONNET, usage({ inputTokens: null }))).toMatchObject({
      status: "incomplete",
    });
  });

  it("adds flat per-request and per-image units", () => {
    const flat: AiPricing = {
      rates: {
        inputPerMillion: "0",
        outputPerMillion: "0",
        perImage: "0.002",
        perRequest: "0.0001",
      },
    };

    expect(priceUsage(flat, usage(), { images: 2 })).toEqual({
      amount: usd("0.0041"),
      status: "complete",
    });
  });

  it("bounds a call by the dearest input rate and tier it could reach", () => {
    const bound = maxCallCost(SONNET, {
      images: 0,
      inputTokens: 300_000,
      outputTokens: 1_000,
    });

    expect(formatDecimal(bound)).toBe("1.8225");
    expect(
      formatDecimal(
        maxCallCost(SONNET, { images: 0, inputTokens: 1_000, outputTokens: 0 }),
      ),
    ).toBe("0.00375");
  });
});

describe("usage normalization", () => {
  const sdkUsage = (
    overrides: Partial<LanguageModelUsage> = {},
  ): LanguageModelUsage => ({
    inputTokenDetails: {
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
      noCacheTokens: undefined,
    },
    inputTokens: 10,
    outputTokenDetails: { reasoningTokens: undefined, textTokens: undefined },
    outputTokens: 5,
    totalTokens: 15,
    ...overrides,
  });

  it("keeps unknown as null and a reported zero as zero", () => {
    const normalized = normalizeUsage(
      sdkUsage({
        inputTokenDetails: {
          cacheReadTokens: 0,
          cacheWriteTokens: undefined,
          noCacheTokens: 10,
        },
      }),
    );

    expect(normalized.cacheReadTokens).toBe(0);
    expect(normalized.cacheWriteTokens).toBeNull();
    expect(normalizeUsage(undefined).inputTokens).toBeNull();
  });

  it("derives total output from its split when only the split is reported", () => {
    const normalized = normalizeUsage(
      sdkUsage({
        outputTokenDetails: { reasoningTokens: 30, textTokens: 20 },
        outputTokens: undefined,
      }),
    );

    expect(normalized.outputTokens).toBe(50);
    expect(normalized.reasoningTokens).toBe(30);
  });
});

describe("cost resolution", () => {
  const pricing = {
    pricing: SONNET,
    source: "pricing" as const,
    version: "config:abc",
  };

  it("prefers the cost the provider reported", () => {
    expect(
      resolveCost({ pricing, reportedCost: usd("0.0042"), usage: usage() }),
    ).toEqual({ amountUsd: "0.0042", source: "provider" });
  });

  it("estimates from pricing and names the version", () => {
    expect(
      resolveCost({ pricing, reportedCost: null, usage: usage() }),
    ).toEqual({
      amountUsd: "0.0045",
      pricingVersion: "config:abc",
      source: "pricing",
    });
  });

  it("is unknown - not zero - without pricing", () => {
    const cost = resolveCost({
      pricing: null,
      reportedCost: null,
      usage: usage(),
    });

    expect(cost).toEqual({
      amountUsd: null,
      reason: "no pricing",
      source: "unknown",
    });
  });
});

describe("provider adapters", () => {
  const adapters = [gatewayProviderAdapter(), openRouterProviderAdapter];

  it("reads the gateway's generation id and reported cost", () => {
    const adapter = resolveProviderAdapter(adapters, "gateway");
    const metadata = { gateway: { cost: "0.00012", generationId: "gen_1" } };

    expect(adapter.reportedCost(metadata)).toBe(usd("0.00012"));
    expect(adapter.requestId({ metadata, responseId: "resp" })).toBe("gen_1");
    expect(adapter.reportedCost({ gateway: {} })).toBeNull();
  });

  it("reads OpenRouter's usage cost", () => {
    const adapter = resolveProviderAdapter(adapters, "openrouter.chat");

    expect(adapter.reportedCost({ openrouter: { usage: { cost: 0.5 } } })).toBe(
      usd("0.5"),
    );
  });

  it("treats direct providers as reporting no cost", () => {
    const adapter = resolveProviderAdapter(adapters, "anthropic.messages");

    expect(adapter).toBe(defaultProviderAdapter);
    expect(
      adapter.requestId({ metadata: undefined, responseId: "msg_1" }),
    ).toBe("msg_1");
  });
});

describe("calendar periods", () => {
  it("starts a month at local midnight in the site's time zone", () => {
    const period = periodContaining(
      new Date("2026-10-15T12:00:00Z"),
      "month",
      "Europe/Warsaw",
    );

    expect(period.start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("puts an instant just after local midnight in the new day", () => {
    const period = periodContaining(
      new Date("2026-03-01T05:30:00Z"),
      "day",
      "America/New_York",
    );

    expect(period.start.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-03-02T05:00:00.000Z");
  });

  it("falls back to UTC for an unknown zone", () => {
    const period = periodContaining(
      new Date("2026-10-15T12:00:00Z"),
      "month",
      "Not/AZone",
    );

    expect(period.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("role policies", () => {
  const base = {
    defaultGranted: false,
    defaultMonthlyPoints: usd("100"),
    override: null,
    permissions: [],
    policies: [],
    root: false,
  };

  it("uses the largest allowance of a user's roles and never sums them", () => {
    const policy = resolvePolicy({
      ...base,
      permissions: [{ dailyLimit: 5, granted: true }],
      policies: [
        { monthlyPoints: usd("500"), unlimited: false },
        { monthlyPoints: usd("2000"), unlimited: false },
      ],
    });

    expect(policy.monthlyPoints).toBe(usd("2000"));
  });

  it("grants when any role grants, with the largest daily limit", () => {
    const policy = resolvePolicy({
      ...base,
      permissions: [
        { dailyLimit: 5, granted: true },
        { dailyLimit: 20, granted: true },
        { dailyLimit: null, granted: false },
      ],
    });

    expect(policy).toMatchObject({ dailyLimit: 20, granted: true });
  });

  it("falls back to the action's default when no role says anything", () => {
    expect(resolvePolicy({ ...base, defaultGranted: true }).granted).toBe(true);
    expect(resolvePolicy(base).granted).toBe(false);
  });

  it("lets an explicit user override replace what the roles give", () => {
    const policy = resolvePolicy({
      ...base,
      override: { blocked: false, monthlyPoints: usd("5"), unlimited: false },
      policies: [{ monthlyPoints: null, unlimited: true }],
    });

    expect(policy.monthlyPoints).toBe(usd("5"));
    expect(
      resolvePolicy({
        ...base,
        override: { blocked: true, monthlyPoints: null, unlimited: false },
        root: true,
      }).granted,
    ).toBe(false);
  });

  it("gives root roles access with no personal cap", () => {
    expect(resolvePolicy({ ...base, root: true })).toEqual({
      dailyLimit: null,
      granted: true,
      monthlyPoints: null,
    });
  });
});

describe("budget planning", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("holds global, personal points and the daily counter for a user run, in lock order", () => {
    const items = planBudgetItems({
      actorType: "user",
      daily: { limit: 3, permissionKey: "@vitnode/blog:excerpt" },
      globalMonthlyUsd: usd("10"),
      now,
      systemMonthlyUsd: null,
      timeZone: "UTC",
      usd: usd("0.004"),
      userId: 7,
      userMonthlyPoints: usd("100"),
    });

    expect(items.map(item => item.scopeKey)).toEqual([
      "global",
      "user:7",
      "user:7:daily:@vitnode/blog:excerpt",
    ]);
    expect(formatDecimal(items[1].amount)).toBe("4");
  });

  it("never touches personal budgets for system work", () => {
    const items = planBudgetItems({
      actorType: "system",
      daily: null,
      globalMonthlyUsd: usd("10"),
      now,
      systemMonthlyUsd: null,
      timeZone: "UTC",
      usd: usd("0.004"),
      userId: null,
      userMonthlyPoints: usd("0"),
    });

    expect(items.map(item => item.scopeKey)).toEqual(["global", "system"]);
  });

  it("refuses a run that would overspend, and an unpriced run under a cap", () => {
    const items = planBudgetItems({
      actorType: "system",
      daily: null,
      globalMonthlyUsd: usd("1"),
      now,
      systemMonthlyUsd: null,
      timeZone: "UTC",
      usd: usd("0.5"),
      userId: null,
      userMonthlyPoints: null,
    });
    const rows = new Map([
      [
        "global",
        {
          limitAmount: usd("1"),
          periodEnd: items[0].period.end,
          reservedAmount: usd("0.3"),
          scopeKey: "global",
          spentAmount: usd("0.3"),
        },
      ],
    ]);

    expect(findExceededBudget(items, rows, { priced: true })?.code).toBe(
      "AI_BUDGET_EXHAUSTED",
    );
    expect(findExceededBudget(items, new Map(), { priced: false })?.code).toBe(
      "AI_PRICING_MISSING",
    );
  });

  it("charges points only for delivered results, money always", () => {
    const chargedUsd = usd("0.002");

    expect(
      settlementCharge({
        chargedUsd,
        delivered: false,
        deliveredUsd: chargedUsd,
        unit: "points",
      }),
    ).toBe(0n);
    expect(
      settlementCharge({
        chargedUsd,
        delivered: false,
        deliveredUsd: chargedUsd,
        unit: "usd",
      }),
    ).toBe(chargedUsd);
    expect(
      formatDecimal(
        settlementCharge({
          chargedUsd,
          delivered: true,
          deliveredUsd: chargedUsd,
          unit: "points",
        }),
      ),
    ).toBe("2");
  });
});

describe("assertAiModelPricing", () => {
  it("accepts models with and without a price in the config", () => {
    expect(() =>
      assertAiModelPricing([
        { id: "free" },
        {
          id: "priced",
          pricing: { rates: { inputPerMillion: "3", outputPerMillion: "15" } },
        },
      ]),
    ).not.toThrow();
  });

  it("stops the boot on a price that isn't a decimal string", () => {
    expect(() =>
      assertAiModelPricing([
        {
          id: "typo",
          pricing: { rates: { inputPerMillion: 3, outputPerMillion: "15" } },
        },
      ]),
    ).toThrow(/AI model "typo" has invalid pricing/);
  });
});
