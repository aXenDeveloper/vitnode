import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { runUpdateCheckFor } from "@/api/lib/updates/context";

const busySchema = z.object({
  status: z.enum(["cooldown", "disabled", "running"]),
  retryAfterSeconds: z.number().nullable(),
});

export const checkPluginUpdatesAdminRoute = buildRoute({
  adminStaffPermission: {
    module: "plugins",
    permission: "can_check_updates",
  },
  route: {
    method: "post",
    description:
      "Check core and every installed plugin for updates and security updates now. Shares its lease with the daily cron job.",
    path: "/updates/check",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              status: z.literal("completed"),
              sources: z.number(),
              failedSources: z.number(),
              components: z.number(),
              updates: z.number(),
              securityUpdates: z.number(),
            }),
          },
        },
        description: "The check finished",
      },
      403: { description: "Access Denied" },
      409: {
        content: { "application/json": { schema: busySchema } },
        description: "A check is already running, or checks are turned off",
      },
      429: {
        content: { "application/json": { schema: busySchema } },
        description: "A manual check ran moments ago",
      },
    },
  },
  handler: async c => {
    if (!c.get("core").updates.enabled) {
      return c.json(
        { retryAfterSeconds: null, status: "disabled" as const },
        409,
      );
    }

    const outcome = await runUpdateCheckFor(c, { manual: true });

    if (outcome.status === "completed") {
      return c.json({ ...outcome.summary, status: "completed" as const }, 200);
    }

    c.header("Retry-After", String(outcome.retryAfterSeconds));

    return outcome.reason === "running"
      ? c.json(
          {
            retryAfterSeconds: outcome.retryAfterSeconds,
            status: "running" as const,
          },
          409,
        )
      : c.json(
          {
            retryAfterSeconds: outcome.retryAfterSeconds,
            status: "cooldown" as const,
          },
          429,
        );
  },
});
