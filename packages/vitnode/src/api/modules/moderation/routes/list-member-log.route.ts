import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { listAuditLogsWithDetails } from "@/api/lib/audit/query";
import { requireModerator } from "@/api/lib/moderation/access";
import { hasWarningPermission } from "@/api/lib/moderation/warnings/access";
import { AUDIT_CORE_PLUGIN_ID } from "@/lib/audit/const";
import { WARNING_PERMISSIONS } from "@/lib/moderation/warnings";

import { loadReportPeople } from "../lib/people";
import { json, reportPersonSchema } from "../moderation.schema";
import { commonResponses, idParams } from "../warnings.schema";

const LOG_PAGE_SIZE = 20;

export const memberLogRoute = buildRoute({
  route: {
    method: "get",
    path: "/members/{id}/log",
    description:
      "A member's moderation log for the ModCP, newest first: warnings issued and revoked and, with `can_view_sanctions`, suspensions applied and lifted. Read from the central activity log; needs `can_view`. Never includes staff notes",
    request: {
      params: idParams,
      query: z.object({ cursor: z.string().max(200).optional() }),
    },
    responses: {
      200: json(
        z.object({
          edges: z.array(
            z.object({
              id: z.number(),
              action: z.string(),
              actor: reportPersonSchema.nullable(),
              actorName: z.string().nullable(),
              createdAt: z.date(),
              metadata: z.record(z.string(), z.unknown()),
            }),
          ),
          pageInfo: z.object({
            endCursor: z.string().nullable(),
            hasNextPage: z.boolean(),
          }),
        }),
        "One page of the member's moderation log",
      ),
      401: commonResponses[401],
      403: { description: "Needs `can_view` warnings" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    if (!hasWarningPermission(moderator.set, WARNING_PERMISSIONS.view)) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    const { id } = c.req.valid("param");
    const { cursor } = c.req.valid("query");
    const viewSanctions = hasWarningPermission(
      moderator.set,
      WARNING_PERMISSIONS.viewSanctions,
    );

    const { edges, pageInfo } = await listAuditLogsWithDetails(c, {
      cursor,
      filters: {
        area: "moderator",
        pluginId: AUDIT_CORE_PLUGIN_ID,
        targetId: String(id),
        targetType: "user",
      },
      first: LOG_PAGE_SIZE,
    });
    const visible = edges.filter(
      entry => viewSanctions || !entry.action.startsWith("sanction."),
    );
    const people = await loadReportPeople(
      c,
      visible.map(entry => entry.actor?.id),
    );

    return c.json(
      {
        edges: visible.map(entry => ({
          id: entry.id,
          action: entry.action,
          actor: entry.actor ? (people.get(entry.actor.id) ?? null) : null,
          actorName: entry.actorName,
          createdAt: entry.createdAt,
          metadata: entry.metadata,
        })),
        pageInfo,
      },
      200,
    );
  },
});
