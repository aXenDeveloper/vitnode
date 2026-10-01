import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/lib/route";
import {
  resolveUserImagePolicy,
  setUserImage,
  zodUserImageKind,
} from "@/api/lib/user-images";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";

export const uploadUserImageRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Upload the signed-in user's avatar or cover. Replaces the previous image.",
    path: "/{kind}",
    request: {
      params: z.object({
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
        description: "The file failed the role's rules for this image",
      },
      401: {
        description: "Not signed in",
      },
      403: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "The user's roles do not allow this image",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { kind } = c.req.valid("param");
    const { file } = c.req.valid("form");

    const policy = await resolveUserImagePolicy(c, user);
    if (!policy[kind].allowed) {
      return c.json(
        { error: `Your role does not allow uploading a ${kind}.` },
        403,
      );
    }

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
