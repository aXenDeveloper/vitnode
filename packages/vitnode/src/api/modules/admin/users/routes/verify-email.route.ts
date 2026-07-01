import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";

export const verifyEmailUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
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

    const db = c.get("db");

    const [user] = await db
      .select({ id: core_users.id })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    await assertCanEditAdminTarget(c, userId);

    const [updated] = await db
      .update(core_users)
      .set({ emailVerified: true })
      .where(eq(core_users.id, user.id))
      .returning({
        name: core_users.name,
        emailVerified: core_users.emailVerified,
      });

    return c.json(
      { name: updated.name, emailVerified: updated.emailVerified },
      200,
    );
  },
});
