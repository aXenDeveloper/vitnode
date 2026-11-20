import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { core_users } from "@/database/users";

import { json } from "../reactions.schema";

const settingsSchema = z.object({
  /** Reactions the member gives appear in their profile timeline. */
  showReactionsOnProfile: z.boolean(),
});

export const showMyReactionSettingsRoute = buildRoute({
  route: {
    method: "get",
    path: "/me/settings",
    description: "The signed-in member's reaction settings",
    responses: {
      200: json(settingsSchema, "Reaction settings"),
      401: { description: "Unauthorized" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });

    const [row] = await c
      .get("db")
      .select({ showReactionsOnProfile: core_users.showReactionsOnProfile })
      .from(core_users)
      .where(eq(core_users.id, user.id))
      .limit(1);

    return c.json(
      { showReactionsOnProfile: row?.showReactionsOnProfile ?? true },
      200,
    );
  },
});

export const updateMyReactionSettingsRoute = buildRoute({
  route: {
    method: "put",
    path: "/me/settings",
    description:
      "Save the signed-in member's reaction settings: whether the reactions they give appear in their profile timeline",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: settingsSchema } },
      },
    },
    responses: {
      200: json(settingsSchema, "Saved settings"),
      401: { description: "Unauthorized" },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Unauthorized" });

    const { showReactionsOnProfile } = c.req.valid("json");
    await c
      .get("db")
      .update(core_users)
      .set({ showReactionsOnProfile })
      .where(eq(core_users.id, user.id));

    return c.json({ showReactionsOnProfile }, 200);
  },
});
