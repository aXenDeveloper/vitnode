import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { loadUserAiUsage } from "@/api/lib/ai/usage-summary";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const zodAiUserUsage = z.object({
  actions: z.array(
    z.object({
      dailyLimit: z.number().nullable(),
      description: z.string().nullable(),
      key: z.string(),
      permissionKey: z.string(),
      usedToday: z.number(),
    }),
  ),
  enabled: z.boolean(),
  notice: z.enum([
    "exhausted",
    "near_limit",
    "no_allowance",
    "none",
    "site_paused",
  ]),
  points: z.object({
    available: z.string().nullable(),
    reserved: z.string(),
    total: z.string().nullable(),
    used: z.string(),
  }),
  resetsAt: z.string(),
  sitePaused: z.boolean(),
});

/** The signed-in user's own allowance - there is no parameter for anybody else. */
export const aiUsageRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Your AI points, reservations, reset date and the AI features you can use.",
    path: "/usage",
    responses: {
      200: {
        content: { "application/json": { schema: zodAiUserUsage } },
        description: "Your AI usage",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);

    return c.json(await loadUserAiUsage(c, c.get("ai").ledger(), user.id), 200);
  },
});
