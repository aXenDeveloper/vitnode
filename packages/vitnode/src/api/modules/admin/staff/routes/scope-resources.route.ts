import { z } from "@hono/zod-openapi";

import { findModerationScope } from "@/api/lib/moderation/registry";
import { isModerationResourceId } from "@/api/lib/moderation/scopes";
import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

import { staffPermissionModuleByType } from "../lib/schema";

const resourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  context: z.array(z.string()),
});

const PAGE_SIZE = 20;

export const scopeResourcesStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: {
    module: staffPermissionModuleByType.moderator,
    permission: "can_edit",
  },
  route: {
    method: "get",
    description:
      "List the resources of one moderation scope family for the moderator editor (Admin only)",
    path: "/scope-resources/{family}",
    request: {
      params: z.object({ family: z.string().max(100) }),
      query: z.object({
        search: z.string().max(100).optional(),
        cursor: z.string().max(200).optional(),
        ids: z.string().max(4000).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(resourceSchema),
              missing: z.array(z.string()),
              nextCursor: z.string().nullable(),
            }),
          },
        },
        description: "One page of resources, or the requested ones",
      },
      403: { description: "Access Denied" },
      404: { description: "Unknown scope family" },
    },
  },
  handler: async c => {
    const { family } = c.req.valid("param");
    const scope = findModerationScope(c.get("core").moderation, family);
    if (!scope) return c.json({ error: "Unknown scope family" }, 404);

    const { cursor, ids, search } = c.req.valid("query");
    const normalize = (item: {
      context?: string[];
      id: string;
      label: string;
    }) => ({ id: item.id, label: item.label, context: item.context ?? [] });

    if (ids !== undefined) {
      const wanted = [
        ...new Set(ids.split(",").filter(id => isModerationResourceId(id))),
      ].slice(0, 200);
      const found = wanted.length ? await scope.definition.find(c, wanted) : [];
      const foundIds = new Set(found.map(item => item.id));

      return c.json(
        {
          items: found.map(normalize),
          missing: wanted.filter(id => !foundIds.has(id)),
          nextCursor: null,
        },
        200,
      );
    }

    const page = await scope.definition.list(c, {
      cursor: cursor ?? null,
      limit: PAGE_SIZE,
      search: search?.trim() === "" ? undefined : search?.trim(),
    });

    return c.json(
      {
        items: page.items.slice(0, PAGE_SIZE).map(normalize),
        missing: [],
        nextCursor: page.nextCursor,
      },
      200,
    );
  },
});
