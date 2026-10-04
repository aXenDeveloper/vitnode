import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { loadCronHealth } from "@/api/modules/cron/helpers/load-cron-health";
import { CONFIG_PLUGIN } from "@/config";
import { isCronSecretRejected } from "@/lib/config";

export const getCronHealthRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "cron", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Report whether the cron scheduler is running its jobs on time",
    path: "/health",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              active: z.boolean(),
              jobs: z.number(),
              lastRun: z.string().nullable(),
              nextRun: z.string().nullable(),
              overdueJobs: z.number(),
              secretRejected: z.boolean(),
              stale: z.boolean(),
            }),
          },
        },
        description: "Cron health",
      },
    },
  },
  handler: async c => {
    const health = await loadCronHealth(c.get("db"));

    return c.json(
      {
        active: c.get("core").hasCronAdapter,
        jobs: health.jobs,
        lastRun: health.lastRun?.toISOString() ?? null,
        nextRun: health.nextRun?.toISOString() ?? null,
        overdueJobs: health.overdueJobs,
        secretRejected: isCronSecretRejected(c.get("core").cronSecret),
        stale: health.stale,
      },
      200,
    );
  },
});
