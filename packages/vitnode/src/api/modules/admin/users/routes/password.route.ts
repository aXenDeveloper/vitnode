import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { assertPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { buildRoute } from "@/api/lib/route";
import { PasswordModel } from "@/api/models/password";
import { revokeSessions } from "@/api/models/session-revoke";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";

export const zodSetPasswordUserAdminSchema = z.object({
  password: z.string().min(8).openapi({ example: "Test123!" }),
});

export const setPasswordUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "put",
    description:
      "Set a user's password by id and sign them out of every device (Admin only)",
    path: "/{id}/password",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSetPasswordUserAdminSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(true) }),
          },
        },
        description: "Password set and every session revoked",
      },
      400: {
        description: "Invalid password",
      },
      403: {
        description: "Access Denied, or password sign-in is disabled",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "User not found",
      },
    },
  },
  handler: async c => {
    assertPasswordSignInEnabled(c);
    const { id } = c.req.valid("param");
    const { password } = c.req.valid("json");
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

    await assertCanEditAdminTarget(c, user.id);

    const hashedPassword = await new PasswordModel().encryptPassword(password);
    await db
      .update(core_users)
      .set({ password: hashedPassword })
      .where(eq(core_users.id, user.id));
    await c.get("events").emit("user.password.updated", { userId: user.id });

    await revokeSessions(c, { userId: user.id });

    return c.json({ ok: true as const }, 200);
  },
});
