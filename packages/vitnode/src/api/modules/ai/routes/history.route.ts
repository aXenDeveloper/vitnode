import { and, desc, eq, lt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_ai_runs } from "@/database/ai";

const PAGE_SIZE = 20;

/**
 * The signed-in user's own recent AI operations. The user id comes from the
 * session; no query parameter can widen it.
 */
export const aiHistoryRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Your recent AI operations, newest first.",
    path: "/history",
    request: {
      query: z.object({
        before: z.coerce
          .number()
          .int()
          .positive()
          .max(2_147_483_647)
          .optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                z.object({
                  accepted: z.boolean().nullable(),
                  actionKey: z.string(),
                  chargedPoints: z.string().nullable(),
                  createdAt: z.date(),
                  errorCode: z.string().nullable(),
                  id: z.number(),
                  status: z.string(),
                }),
              ),
              nextBefore: z.number().nullable(),
            }),
          },
        },
        description: "Your AI history",
      },
      401: { description: "Not signed in" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401);
    const { before } = c.req.valid("query");

    const rows = await c
      .get("db")
      .select({
        accepted: core_ai_runs.accepted,
        actionKey: core_ai_runs.actionKey,
        chargedPoints: core_ai_runs.chargedPoints,
        createdAt: core_ai_runs.createdAt,
        errorCode: core_ai_runs.errorCode,
        id: core_ai_runs.id,
        status: core_ai_runs.status,
      })
      .from(core_ai_runs)
      .where(
        and(
          eq(core_ai_runs.actorType, "user"),
          eq(core_ai_runs.userId, user.id),
          before ? lt(core_ai_runs.id, before) : undefined,
        ),
      )
      .orderBy(desc(core_ai_runs.id))
      .limit(PAGE_SIZE + 1);

    const items = rows.slice(0, PAGE_SIZE);

    return c.json(
      {
        items,
        nextBefore: rows.length > PAGE_SIZE ? (items.at(-1)?.id ?? null) : null,
      },
      200,
    );
  },
});
