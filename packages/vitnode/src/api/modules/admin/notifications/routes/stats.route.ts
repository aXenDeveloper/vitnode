import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { isValidTimeZone } from "@/api/lib/notifications/digest-period";
import { buildRoute } from "@/api/lib/route";
import {
  getNotificationStats,
  NOTIFICATION_STATS_RANGES,
} from "@/api/models/notifications/stats";
import { CONFIG_PLUGIN } from "@/config";

const zodTotals = z.object({
  events: z.number(),
  failed: z.number(),
  sent: z.number(),
  skipped: z.number(),
});

export const getNotificationStatsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "notifications", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Published events and finished emails per hour or day for the chosen range, bucketed in the viewer's time zone, with the totals of the period before it.",
    path: "/stats",
    request: {
      query: z.object({
        range: z.enum(NOTIFICATION_STATS_RANGES).default("7d"),
        timeZone: z.string().max(64).default("UTC"),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              points: z.array(zodTotals.extend({ key: z.string() })),
              previous: zodTotals,
              range: z.enum(NOTIFICATION_STATS_RANGES),
              timeZone: z.string(),
              totals: zodTotals,
              unit: z.enum(["day", "hour"]),
            }),
          },
        },
        description: "Notification activity",
      },
      400: { description: "Unknown time zone" },
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const { range, timeZone } = c.req.valid("query");
    if (!isValidTimeZone(timeZone)) {
      throw new HTTPException(400, { message: "Unknown time zone." });
    }

    return c.json(await getNotificationStats(c, { range, timeZone }));
  },
});
