import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import {
  resolveUserImagePolicy,
  setUserImage,
  zodUserImageKind,
} from "@/api/lib/user-images";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";

export const uploadUserImageAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "post",
    description:
      "Upload a user's avatar or cover on their behalf (Admin only). Replaces the previous image.",
    path: "/{id}/images/{kind}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
        kind: zodUserImageKind.openapi({ example: "avatar" }),
      }),
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: z.object({
              file: z
                .instanceof(File)
                .openapi({ format: "binary", type: "string" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ url: z.string() }),
          },
        },
        description: "Image stored and attached to the user",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "The file failed the size or format rules",
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
    const { file } = c.req.valid("form");

    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      return c.json({ error: "User not found" }, 404);
    }

    const [user] = await c
      .get("db")
      .select({ id: core_users.id, roleId: core_users.roleId })
      .from(core_users)
      .where(eq(core_users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    await assertCanEditAdminTarget(c, userId);

    const policy = await resolveUserImagePolicy(c, user, { ignoreAllow: true });

    if (kind === "avatar") {
      await new SsoConnectionModel(c).clearSourcesAfterManualEdit({
        fields: ["avatar"],
        userId: user.id,
      });
    }

    try {
      const stored = await setUserImage(c, {
        file,
        kind,
        maxBytes: policy[kind].maxBytes,
        userId: user.id,
      });

      return c.json({ url: stored.url }, 200);
    } catch (error) {
      if (error instanceof HTTPException && error.status === 400) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  },
});
