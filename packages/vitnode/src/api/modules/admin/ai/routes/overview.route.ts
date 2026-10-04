import { z } from "zod";

import { loadAiOverview } from "@/api/lib/ai/admin-stats";
import {
  divideByInteger,
  formatDecimal,
  parseDecimal,
} from "@/api/lib/ai/decimal";
import { periodContaining } from "@/api/lib/ai/periods";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

const zodBreakdown = z.array(
  z.object({
    failures: z.number(),
    key: z.string(),
    knownCostUsd: z.string(),
    knownOperations: z.number(),
    operations: z.number(),
  }),
);

export const zodAiOverview = z.object({
  alt: z.object({
    imagesDescribed: z.number(),
    knownCostUsd: z.string(),
    perImageUsd: z.string().nullable(),
    perTranslationUsd: z.string().nullable(),
    translations: z.number(),
  }),
  averageDailyCostUsd: z.string(),
  averageOperationCostUsd: z.string().nullable(),
  budget: z.object({
    limitUsd: z.string().nullable(),
    remainingUsd: z.string().nullable(),
    reservedUsd: z.string(),
    spentUsd: z.string(),
    systemLimitUsd: z.string().nullable(),
    systemSpentUsd: z.string(),
  }),
  byAction: zodBreakdown,
  byModel: zodBreakdown,
  byOrigin: zodBreakdown,
  costSources: z.object({
    estimated: z.number(),
    provider: z.number(),
    unknown: z.number(),
  }),
  enabled: z.boolean(),
  failureRate: z.number(),
  knownCostUsd: z.string(),
  operations: z.number(),
  period: z.object({ end: z.string(), start: z.string() }),
  pricingCoverage: z.number(),
  tokens: z.object({ input: z.number(), output: z.number() }),
});

export const ALT_GENERATE_ACTION = "@vitnode/core:media.alt.generate";
export const ALT_TRANSLATE_ACTION = "@vitnode/core:media.alt.translate";

export const aiOverviewAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description: "AI spending and usage for the current or previous month.",
    path: "/overview",
    request: {
      query: z.object({
        period: z.enum(["current", "previous"]).optional(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodAiOverview } },
        description: "AI overview",
      },
    },
  },
  handler: async c => {
    const { period = "current" } = c.req.valid("query");
    const settings = await c.get("ai").ledger().loadSettings();
    const now = new Date();
    const current = periodContaining(now, "month", settings.timeZone);
    const range =
      period === "current"
        ? current
        : periodContaining(
            new Date(current.start.getTime() - 1),
            "month",
            settings.timeZone,
          );

    const overview = await loadAiOverview(c.get("db"), {
      globalLimitUsd: settings.monthlyBudgetUsd,
      now,
      period: range,
      systemLimitUsd: settings.systemMonthlyBudgetUsd,
    });
    const altGenerate = overview.byAction.find(
      row => row.key === ALT_GENERATE_ACTION,
    );
    const altTranslate = overview.byAction.find(
      row => row.key === ALT_TRANSLATE_ACTION,
    );
    const generateCost = parseDecimal(altGenerate?.knownCostUsd ?? "0");
    const translateCost = parseDecimal(altTranslate?.knownCostUsd ?? "0");
    const images = altGenerate?.knownOperations ?? 0;
    const translations = altTranslate?.knownOperations ?? 0;

    return c.json(
      {
        ...overview,
        alt: {
          imagesDescribed: altGenerate?.operations ?? 0,
          knownCostUsd: formatDecimal(generateCost + translateCost),
          // Averages of known costs - shown, never charged. One image's cost
          // includes its share of every language it was translated into.
          perImageUsd:
            images > 0
              ? formatDecimal(
                  divideByInteger(generateCost + translateCost, images),
                )
              : null,
          perTranslationUsd:
            translations > 0
              ? formatDecimal(divideByInteger(translateCost, translations))
              : null,
          translations: altTranslate?.operations ?? 0,
        },
        enabled: settings.enabled,
      },
      200,
    );
  },
});
