import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import {
  listWarningReasons,
  warningReasonSchema,
} from "@/api/lib/moderation/warnings/reasons";

import { requireWarner } from "../lib/require-warner";
import { json } from "../moderation.schema";
import { commonResponses } from "../warnings.schema";

export const listWarningReasonsRoute = buildRoute({
  route: {
    method: "get",
    path: "/warnings/reasons",
    description:
      "Enabled warning reasons, in display order, for the warn form (moderators who can warn)",
    responses: {
      200: json(
        z.object({ reasons: z.array(warningReasonSchema) }),
        "Warning reasons",
      ),
      401: commonResponses[401],
      403: { description: "Cannot warn anyone" },
    },
  },
  handler: async c => {
    await requireWarner(c);

    return c.json(
      { reasons: await listWarningReasons(c, { enabledOnly: true }) },
      200,
    );
  },
});
