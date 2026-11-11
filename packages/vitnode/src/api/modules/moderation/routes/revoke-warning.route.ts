import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";

import { revokeWarning } from "../lib/warnings";
import { json } from "../moderation.schema";
import {
  body,
  commonResponses,
  idParams,
  revokeSchema,
} from "../warnings.schema";

export const revokeWarningRoute = buildRoute({
  route: {
    method: "post",
    path: "/warnings/{id}/revoke",
    description:
      "Revoke a warning with a reason. Its points stop counting at once; the record and any suspension it led to stay",
    request: { params: idParams, ...body(revokeSchema) },
    responses: {
      200: json(
        z.object({ warningId: z.number(), userId: z.number() }),
        "Warning revoked",
      ),
      ...commonResponses,
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    return c.json(await revokeWarning(c, moderator, { id, reason }), 200);
  },
});
