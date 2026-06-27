import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

export const verifyEmailUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Verify a user's email by id (Admin only)",
    path: "/{id}/verify-email",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string(),
              emailVerified: z.boolean(),
            }),
          },
        },
        description: "Email verified",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
        description: "User not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return c.json({ error: "User not found" }, 404);
    }

    const [updated] = await c
      .get("db")
      .update(core_users)
      .set({ emailVerified: true })
      .where(eq(core_users.id, userId))
      .returning({
        name: core_users.name,
        emailVerified: core_users.emailVerified,
      });

    if (!updated) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(
      { name: updated.name, emailVerified: updated.emailVerified },
      200,
    );
  },
});
