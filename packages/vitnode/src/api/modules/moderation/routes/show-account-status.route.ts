import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { findActiveSuspension } from "@/api/lib/moderation/warnings/suspension";

import {
  ownSanctionSchema,
  ownWarningSchema,
  serializeOwnSanction,
  serializeOwnWarnings,
} from "../lib/own-standing";
import { loadActivePoints } from "../lib/warnings";
import { loadUserSanctions, loadUserWarnings } from "../lib/warnings-view";
import { json } from "../moderation.schema";

export const accountStatusRoute = buildRoute({
  route: {
    method: "get",
    path: "/account-status",
    description:
      "The signed-in member's own standing: active warning points, warning history and suspensions. Also answers for a suspended account, whose session is otherwise treated as a guest. Never includes staff notes",
    responses: {
      200: json(
        z.object({
          suspension: z.object({ endsAt: z.date().nullable() }).nullable(),
          activePoints: z.number(),
          warnings: z.array(ownWarningSchema),
          sanctions: z.array(ownSanctionSchema),
        }),
        "The account's standing",
      ),
      401: { description: "Sign in first" },
    },
  },
  handler: async c => {
    const userId = c.get("user")?.id ?? c.get("suspension")?.userId;
    if (!userId) return c.json({ error: "unauthenticated" }, 401);

    const now = new Date();
    const [warnings, sanctions, activePoints, suspension] = await Promise.all([
      loadUserWarnings(c, userId),
      loadUserSanctions(c, userId),
      loadActivePoints(c.get("db"), userId, now),
      findActiveSuspension(c, userId, now),
    ]);

    return c.json(
      {
        suspension: suspension ? { endsAt: suspension.endsAt } : null,
        activePoints,
        warnings: await serializeOwnWarnings(c, warnings, now),
        sanctions: sanctions.map(row => serializeOwnSanction(row, now)),
      },
      200,
    );
  },
});
