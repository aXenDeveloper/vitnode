import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { AUDIT_PERMISSIONS, canAdminAudit } from "@/api/lib/audit/access";
import { viewableContentType } from "@/api/lib/audit/detail";
import {
  listAuditLogsWithDetails,
  zodAuditEntityPage,
} from "@/api/lib/audit/query";
import {
  AUDIT_PLUGIN_ID_MAX_LENGTH,
  AUDIT_TARGET_ID_MAX_LENGTH,
  AUDIT_TARGET_TYPE_MAX_LENGTH,
} from "@/lib/audit/const";

/**
 * Whether the admin may read one entity's history: with the Activity Logs
 * permission always, and for a content record also with `can_view` on its own
 * content type - an editor who can open a category can see who changed it,
 * without being handed the whole site's log.
 */
const canReadEntityHistory = async (
  c: Context,
  { pluginId, targetType }: { pluginId: string; targetType: string },
): Promise<boolean> => {
  if (await canAdminAudit(c, AUDIT_PERMISSIONS.view)) return true;

  return (await viewableContentType(c, targetType))?.pluginId === pluginId;
};

export const activityLogEntityAdminRoute = buildRoute({
  route: {
    method: "get",
    path: "/entity",
    description:
      "The activity history of one resource - a content record or a plugin's own target. Needs Activity Logs `can_view`, or `can_view` on the content type",
    request: {
      query: z.object({
        cursor: z.string().max(200).optional(),
        first: z.coerce.number().int().min(1).max(100).optional(),
        pluginId: z.string().min(1).max(AUDIT_PLUGIN_ID_MAX_LENGTH),
        targetId: z.string().min(1).max(AUDIT_TARGET_ID_MAX_LENGTH),
        targetType: z.string().min(1).max(AUDIT_TARGET_TYPE_MAX_LENGTH),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodAuditEntityPage } },
        description: "One page of the resource's history, newest first",
      },
      403: { description: "May not read this resource's history" },
    },
  },
  handler: async c => {
    const { cursor, first, pluginId, targetId, targetType } =
      c.req.valid("query");
    if (!(await canReadEntityHistory(c, { pluginId, targetType }))) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    return c.json(
      await listAuditLogsWithDetails(c, {
        cursor,
        filters: { pluginId, targetId, targetType },
        first,
      }),
      200,
    );
  },
});
