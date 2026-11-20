import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { json } from "@/modules/reactions/reactions.schema";

import { storeReactionImage } from "../lib/image";
import { errorSchema, uploadResultSchema } from "../reactions.schema";

export const uploadReactionImageAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.reactions.canManage,
  route: {
    method: "post",
    path: "/upload",
    description:
      "Upload a custom reaction image: PNG, JPEG, WebP or GIF (animated too), up to 512 KB (Admin only). It is checked by its contents, scaled to fit 256x256, and an animated image gets a still first frame for reduced motion. Save the reaction with the returned ids",
    request: {
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
      200: json(uploadResultSchema, "Stored image"),
      400: json(errorSchema, "Not a PNG, JPEG, WebP or GIF, or too big"),
      403: { description: "Access Denied" },
    },
  },
  handler: async c => {
    const admin = c.get("admin");
    if (!admin) throw new HTTPException(403);

    const { file } = c.req.valid("form");
    try {
      const stored = await storeReactionImage(c, file, admin.user.id);

      return c.json(
        {
          fileId: stored.fileId,
          image: {
            animated: stored.animated,
            height: stored.height,
            posterUrl: stored.posterUrl,
            url: stored.url,
            width: stored.width,
          },
          posterFileId: stored.posterFileId,
        },
        200,
      );
    } catch (error) {
      if (error instanceof HTTPException && error.status === 400) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  },
});
