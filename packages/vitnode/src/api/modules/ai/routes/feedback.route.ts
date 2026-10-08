import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_runs } from "@/database/ai";

export const aiFeedbackRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Record whether you accepted an AI suggestion.",
    path: "/runs/{id}/feedback",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: {
        required: true,
        content: {
          "application/json": { schema: z.object({ accepted: z.boolean() }) },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ ok: z.literal(true) }) },
        },
        description: "Recorded",
      },
      404: { description: "Not one of your runs" },
    },
  },
  handler: async c => {
    const userId = c.get("admin")?.user.id ?? c.get("user")?.id;
    if (!userId) throw new HTTPException(401);
    const { id } = c.req.valid("param");
    const { accepted } = c.req.valid("json");

    const updated = await c
      .get("db")
      .update(core_ai_runs)
      .set({ accepted, acceptedAt: new Date() })
      .where(
        and(
          eq(core_ai_runs.id, id),
          eq(core_ai_runs.userId, userId),
          eq(core_ai_runs.status, "succeeded"),
        ),
      )
      .returning({ id: core_ai_runs.id });
    if (updated.length === 0) {
      throw new HTTPException(404, { message: "AI run not found" });
    }

    return c.json({ ok: true as const }, 200);
  },
});
