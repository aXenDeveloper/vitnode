import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";

import { revokeSanction } from "../lib/warnings";
import { json } from "../moderation.schema";
import {
  body,
  commonResponses,
  idParams,
  revokeSchema,
} from "../warnings.schema";

export const revokeSanctionRoute = buildRoute({
  route: {
    method: "post",
    path: "/sanctions/{id}/revoke",
    description:
      "Lift one sanction with a reason. Other active sanctions of the member keep applying",
    request: { params: idParams, ...body(revokeSchema) },
    responses: {
      200: json(
        z.object({ sanctionId: z.number(), userId: z.number() }),
        "Sanction revoked",
      ),
      ...commonResponses,
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const { reason } = c.req.valid("json");

    return c.json(await revokeSanction(c, moderator, { id, reason }), 200);
  },
});
