import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { altLanguages, detectMissingAlt } from "@/api/lib/ai/alt";
import { ALT_IMAGE_MEDIA_TYPES } from "@/api/lib/ai/alt-actions";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_files, core_files_alt_state } from "@/database/files";

export const getAltStatusAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Automatic ALT progress: pending, completed, failed and waiting for budget.",
    path: "/alt",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              counts: z.object({
                completed: z.number(),
                failed: z.number(),
                pending: z.number(),
                skipped: z.number(),
                waitingBudget: z.number(),
              }),
              eligibleImages: z.number(),
              enabled: z.boolean(),
              languages: z.array(z.string()),
            }),
          },
        },
        description: "ALT progress",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const settings = await c.get("ai").ledger().loadSettings();
    const [states, [eligible], languages] = await Promise.all([
      db
        .select({ status: core_files_alt_state.status, total: count() })
        .from(core_files_alt_state)
        .groupBy(core_files_alt_state.status),
      db
        .select({ total: count() })
        .from(core_files)
        .where(
          and(
            inArray(core_files.mimeType, [...ALT_IMAGE_MEDIA_TYPES]),
            eq(core_files.altPolicy, "automatic"),
          ),
        ),
      altLanguages(db, settings),
    ]);
    const of = (status: string) =>
      states.find(row => row.status === status)?.total ?? 0;

    return c.json(
      {
        counts: {
          completed: of("completed"),
          failed: of("failed"),
          pending: of("pending"),
          skipped: of("skipped"),
          waitingBudget: of("waiting_budget"),
        },
        eligibleImages: eligible.total,
        enabled: settings.enabled && settings.altEnabled,
        languages,
      },
      200,
    );
  },
});

export const sweepAltAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "ai", permission: "can_manage" },
  route: {
    method: "post",
    description:
      "Look for images missing ALT text now, instead of waiting for the hourly sweep.",
    path: "/alt/sweep",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ enqueued: z.number(), scanned: z.number() }),
          },
        },
        description: "How many images were queued",
      },
    },
  },
  handler: async c => c.json(await detectMissingAlt(c), 200),
});
