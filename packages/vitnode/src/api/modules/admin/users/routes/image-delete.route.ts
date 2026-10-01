import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { removeUserImage, zodUserImageKind } from "@/api/lib/user-images";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";

export const deleteUserImageAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "delete",
    description: "Remove a user's avatar or cover (Admin only).",
    path: "/{id}/images/{kind}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
        kind: zodUserImageKind.openapi({ example: "avatar" }),
      }),
    },
    responses: {
      200: {
        description: "Image removed",
      },
      403: {
        description: "Access Denied",
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
    const { id, kind } = c.req.valid("param");

    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return c.json({ error: "User not found" }, 404);
    }

    const [user] = await c
      .get("db")
      .select({ id: core_users.id })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    await assertCanEditAdminTarget(c, userId);
    if (kind === "avatar") {
      await new SsoConnectionModel(c).clearSourcesAfterManualEdit({
        fields: ["avatar"],
        userId: user.id,
      });
    }
    await removeUserImage(c, { kind, userId: user.id });

    return c.body(null, 200);
  },
});
