import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { removeUserImage, zodUserImageKind } from "@/api/lib/user-images";
import { SsoConnectionModel } from "@/api/models/sso-connection";

export const deleteUserImageRoute = buildRoute({
  route: {
    method: "delete",
    description: "Remove the signed-in user's avatar or cover.",
    path: "/{kind}",
    request: {
      params: z.object({
        kind: zodUserImageKind.openapi({ example: "avatar" }),
      }),
    },
    responses: {
      200: {
        description: "Image removed",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const { kind } = c.req.valid("param");
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
