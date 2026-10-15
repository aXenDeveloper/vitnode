import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";

const permissionStaffModulesSchema = z.record(
  z.string(),
  z.array(
    z.object({
      permission: z.string(),
      dependsOn: z.array(z.string()),
      scope: z.string().optional(),
    }),
  ),
);

const scopeFamilySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
});

export const permissionCatalogStaffAdminRoute = buildRoute({
  route: {
    method: "get",
    description:
      "Get the staff permission catalog declared by every plugin (Admin only)",
    path: "/permission-catalog",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                pluginId: z.string(),
                admin: permissionStaffModulesSchema,
                moderator: permissionStaffModulesSchema,
                scopes: z.array(scopeFamilySchema),
              }),
            ),
          },
        },
        description:
          "Staff permission catalog, with the moderation scope families each plugin registers",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: c => {
    const { moderation, permissionStaff } = c.get("core");

    return c.json(
      permissionStaff.map(plugin => ({
        ...plugin,
        scopes: (moderation?.scopes ?? [])
          .filter(scope => scope.pluginId === plugin.pluginId)
          .map(({ definition }) => ({
            id: definition.id,
            label: definition.label,
            description: definition.description ?? null,
          })),
      })),
      200,
    );
  },
});
