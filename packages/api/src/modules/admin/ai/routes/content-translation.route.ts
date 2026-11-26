import { and, avg, count, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/builders";
import {
  core_content_ai_translation_jobs,
  core_content_ai_translations,
} from "@/database/content-translations";
import { core_languages } from "@/database/languages";
import { periodContaining } from "@/lib/ai/periods";
import { auditDiff } from "@/lib/audit/diff";
import { writeAuditLog } from "@/lib/audit/write";
import { contentTranslationSpendUsd } from "@/lib/content-translation/budget";
import {
  contentTranslationModelReady,
  readContentTranslationSettings,
  saveContentTranslationSettings,
} from "@/lib/content-translation/settings";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";

import { zodDecimalString } from "../ai.schema";

const zodContentTranslationSettings = z.object({
  enabled: z.boolean(),
  locales: z.array(z.string().min(2).max(32)).max(50),
  monthlyBudgetUsd: zodDecimalString.nullable(),
  retentionDays: z.number().int().min(1).max(3650),
  userHourlyLimit: z.number().int().min(1).max(10_000),
});

const zodContentTranslationAdminResponse = zodContentTranslationSettings.extend(
  {
    /** The site's languages, to pick the allowlist from. */
    languages: z.array(z.object({ code: z.string(), name: z.string() })),
    /** A priced model with the needed capabilities can translate now. */
    modelReady: z.boolean(),
    stats: z.object({
      averageLatencyMs: z.number().nullable(),
      failed: z.number().int(),
      generated: z.number().int(),
      pending: z.number().int(),
      skipped: z.number().int(),
      spentUsd: z.string(),
      stored: z.number().int(),
      waitingBudget: z.number().int(),
    }),
  },
);

export const getContentTranslationAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canView,
  route: {
    method: "get",
    description:
      "Automatic translation settings, and this month's translation usage.",
    path: "/content-translation",
    responses: {
      200: {
        content: {
          "application/json": { schema: zodContentTranslationAdminResponse },
        },
        description: "Automatic translation settings and usage",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const [settings, modelReady, { spentUsd }, { timeZone }] =
      await Promise.all([
        readContentTranslationSettings(db),
        contentTranslationModelReady(c),
        contentTranslationSpendUsd(c),
        c.get("ai").ledger().loadSettings(),
      ]);
    const monthStart = periodContaining(new Date(), "month", timeZone).start;
    const jobs = core_content_ai_translation_jobs;

    const [languages, [stored], states, [latency]] = await Promise.all([
      db
        .select({ code: core_languages.code, name: core_languages.name })
        .from(core_languages),
      db
        .select({ total: count() })
        .from(core_content_ai_translations)
        .where(isNull(core_content_ai_translations.supersededAt)),
      db
        .select({ status: jobs.status, total: count() })
        .from(jobs)
        .where(gte(jobs.updatedAt, monthStart))
        .groupBy(jobs.status),
      db
        .select({
          average: avg(
            sql<number>`extract(epoch from (${jobs.completedAt} - ${jobs.requestedAt})) * 1000`,
          ),
        })
        .from(jobs)
        .where(
          and(eq(jobs.status, "completed"), gte(jobs.completedAt, monthStart)),
        ),
    ]);
    const of = (status: (typeof states)[number]["status"]) =>
      states.find(row => row.status === status)?.total ?? 0;

    return c.json(
      {
        ...settings,
        languages,
        modelReady,
        stats: {
          averageLatencyMs:
            latency?.average === null || latency?.average === undefined
              ? null
              : Math.round(Number(latency.average)),
          failed: of("failed"),
          generated: of("completed"),
          pending: of("pending") + of("running"),
          skipped: of("skipped"),
          spentUsd,
          stored: stored?.total ?? 0,
          waitingBudget: of("waiting_budget"),
        },
      },
      200,
    );
  },
});

export const updateContentTranslationAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.ai.canManage,
  route: {
    method: "put",
    description: "Update the automatic translation settings.",
    path: "/content-translation",
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: zodContentTranslationSettings },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Saved",
      },
    },
  },
  handler: async c => {
    const body = c.req.valid("json");
    const values = { ...body, locales: [...new Set(body.locales)] };

    await c.get("db").transaction(async tx => {
      const before = await readContentTranslationSettings(tx);
      await saveContentTranslationSettings(tx, values);
      const changes = auditDiff({
        after: values,
        before,
        include: Object.keys(values) as (keyof typeof values)[],
      });
      if (changes) {
        await writeAuditLog(
          c,
          {
            action: "settings.updated",
            changes,
            target: {
              id: "content-translation",
              label: "Automatic translation",
              type: "settings",
            },
          },
          tx,
        );
      }
    });

    return c.json({ ok: true as const }, 200);
  },
});
