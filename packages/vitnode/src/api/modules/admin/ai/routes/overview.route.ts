import { z } from "zod";

import { loadAiOverview } from "@/api/lib/ai/admin-stats";
import { localDayOf } from "@/api/lib/ai/periods";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import {
  AI_OVERVIEW_PRESETS,
  aiMonthOf,
  compareAiRange,
  isAiMonth,
  resolveAiOverviewRange,
} from "@/lib/ai/overview-range";

const zodUsageTotals = z.object({
  chargedUsd: z.string(),
  failures: z.number(),
  inputTokens: z.number(),
  knownCostUsd: z.string(),
  knownOperations: z.number(),
  operations: z.number(),
  outputTokens: z.number(),
});

const zodUsageDay = zodUsageTotals.extend({ day: z.string() });

const zodUsageEntity = z.object({
  current: zodUsageTotals,
  key: z.string(),
  previous: zodUsageTotals,
});

const zodBudgetDay = z.object({ costUsd: z.string(), day: z.string() });

export const zodAiOverview = z.object({
  budget: z.object({
    dailyRateUsd: z.string(),
    days: z.array(zodBudgetDay),
    end: z.string(),
    forecastUsd: z.string().nullable(),
    limitUsd: z.string().nullable(),
    live: z.boolean(),
    month: z.string(),
    monthlyAtRateUsd: z.string(),
    previousDays: z.array(zodBudgetDay),
    reservedUsd: z.string(),
    spentUsd: z.string(),
    start: z.string(),
  }),
  byAction: z.array(zodUsageEntity),
  byModel: z.array(zodUsageEntity),
  compare: z.object({
    days: z.array(zodUsageDay),
    end: z.string(),
    kind: z.enum(["month-to-date", "preceding", "previous-month"]),
    start: z.string(),
    totals: zodUsageTotals,
  }),
  enabled: z.boolean(),
  firstDay: z.string().nullable(),
  range: z.object({
    days: z.array(zodUsageDay),
    end: z.string(),
    preset: z.enum(AI_OVERVIEW_PRESETS).nullable(),
    start: z.string(),
    totals: zodUsageTotals,
  }),
  timeZone: z.string(),
  today: z.string(),
});

export const aiOverviewAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description:
      "AI usage and spend for a date range, compared with the range before it, plus one month's budget with a forecast at the range's pace.",
    path: "/overview",
    request: {
      query: z.object({
        from: z.string().optional(),
        month: z.string().optional(),
        range: z.enum(AI_OVERVIEW_PRESETS).optional(),
        to: z.string().optional(),
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
    const query = c.req.valid("query");
    const settings = await c.get("ai").ledger().loadSettings();
    const now = new Date();
    const today = localDayOf(now, settings.timeZone);
    const { preset, range } = resolveAiOverviewRange({
      from: query.from,
      preset: query.range,
      to: query.to,
      today,
    });
    const month =
      isAiMonth(query.month) && query.month <= aiMonthOf(today)
        ? query.month
        : aiMonthOf(range.end);

    const overview = await loadAiOverview(c.get("db"), {
      compare: compareAiRange(range, today),
      limitUsd: settings.monthlyBudgetUsd,
      month,
      now,
      preset,
      range,
      timeZone: settings.timeZone,
      today,
    });

    return c.json({ ...overview, enabled: settings.enabled }, 200);
  },
});
