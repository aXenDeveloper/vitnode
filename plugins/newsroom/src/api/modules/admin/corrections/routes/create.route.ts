import { z } from "@hono/zod-openapi";
import { respondJson } from "@vitnode/core/api/lib/respond-json";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import {
  zodCorrection,
  zodFileCorrectionBody,
} from "@/api/modules/corrections/corrections.schema";
import { createCorrectionsService } from "@/api/modules/corrections/corrections.service";
import { staffPermissions } from "@/staff-permissions";

const zodFiledCorrection = zodCorrection.extend({
  articleId: z.number().int().positive(),
});

export const createCorrectionRoute = buildRoute({
  adminStaffPermission: staffPermissions.admin.corrections.canCreate,
  route: {
    method: "post",
    path: "/",
    description:
      "Files a correction on an article. Readers see it under the article.",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodFileCorrectionBody } },
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: zodFiledCorrection } },
        description: "The filed correction",
      },
      403: {
        description: "Requires the corrections.can_create staff permission.",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.literal("article_not_found") }),
          },
        },
        description: "No article with this id",
      },
    },
  },
  handler: async c => {
    const admin = c.get("admin");
    if (!admin) throw new HTTPException(403);

    const result = await createCorrectionsService({
      cache: c.get("cache"),
      db: c.get("db"),
      events: c.get("events"),
      queue: c.get("queue"),
    }).file({ ...c.req.valid("json"), actor: { id: admin.user.id } });
    if (!result.ok) return c.json({ error: result.error }, 404);

    return respondJson(c, 201, zodFiledCorrection, {
      ...result.correction,
      createdAt: result.correction.createdAt.toISOString(),
    });
  },
});
