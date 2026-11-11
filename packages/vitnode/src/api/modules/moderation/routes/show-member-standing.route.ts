import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { WarningPermission } from "@/api/lib/moderation/warnings/access";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import {
  canWarnAnywhere,
  hasWarningPermission,
} from "@/api/lib/moderation/warnings/access";
import { WARNING_PERMISSIONS } from "@/lib/moderation/warnings";

import { loadReportPeople } from "../lib/people";
import { loadActivePoints } from "../lib/warnings";
import {
  loadUserSanctions,
  loadUserWarnings,
  sanctionSchema,
  serializeSanctions,
  serializeStaffWarnings,
  staffWarningSchema,
} from "../lib/warnings-view";
import { errorSchema, json, reportPersonSchema } from "../moderation.schema";
import { commonResponses, idParams } from "../warnings.schema";

export const memberStandingRoute = buildRoute({
  route: {
    method: "get",
    path: "/members/{id}",
    description:
      "A member's standing for the ModCP: global active points, the warnings this moderator may see and, with `can_view_sanctions`, their sanctions",
    request: { params: idParams },
    responses: {
      200: json(
        z.object({
          user: reportPersonSchema,
          activePoints: z.number(),
          hiddenWarnings: z.number(),
          warnings: z.array(staffWarningSchema),
          sanctions: z.array(sanctionSchema).nullable(),
          permissions: z.object({
            warn: z.boolean(),
            revoke: z.boolean(),
            viewSanctions: z.boolean(),
            manageSanctions: z.boolean(),
            viewLog: z.boolean(),
          }),
        }),
        "The member's standing",
      ),
      401: commonResponses[401],
      403: { description: "Not a moderator" },
      404: json(errorSchema, "No such member"),
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    const { id } = c.req.valid("param");
    const has = (permission: WarningPermission) =>
      hasWarningPermission(moderator.set, permission);
    if (!has(WARNING_PERMISSIONS.view) && !canWarnAnywhere(c, moderator.set)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const people = await loadReportPeople(c, [id]);
    const user = people.get(id);
    if (!user) return c.json({ error: "not_found" }, 404);

    const now = new Date();
    const viewSanctions = has(WARNING_PERMISSIONS.viewSanctions);
    const [rows, sanctionRows, activePoints] = await Promise.all([
      loadUserWarnings(c, id),
      viewSanctions ? loadUserSanctions(c, id) : null,
      loadActivePoints(c.get("db"), id, now),
    ]);
    const warnings = await serializeStaffWarnings(c, moderator, rows, now);

    return c.json(
      {
        user,
        activePoints,
        hiddenWarnings: rows.length - warnings.length,
        warnings,
        sanctions: sanctionRows
          ? await serializeSanctions(c, sanctionRows, now)
          : null,
        permissions: {
          warn: has(WARNING_PERMISSIONS.warn) && id !== moderator.user.id,
          revoke: has(WARNING_PERMISSIONS.revoke),
          viewSanctions,
          manageSanctions: has(WARNING_PERMISSIONS.manageSanctions),
          viewLog: has(WARNING_PERMISSIONS.view),
        },
      },
      200,
    );
  },
});
