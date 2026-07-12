import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";

// Role names are not a column on `core_roles` - every translation lives in
// `core_languages_words`, so the name is the full list of per-language values.
export const zodRoleNameSchema = z
  .array(
    z.object({
      languageCode: z.string(),
      value: z.string().min(1).max(255),
    }),
  )
  .min(1);

export const zodCreateRoleAdminSchema = z.object({
  name: zodRoleNameSchema,
  color: z.string().max(19).optional(),
});

export const createRoleAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Create a new role (Admin only)",
    path: "/create",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodCreateRoleAdminSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Role created",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: async c => {
    const { name, color } = c.req.valid("json");

    const [role] = await c
      .get("db")
      .insert(core_roles)
      .values({ color: color?.trim() ? color : null, updatedAt: new Date() })
      .returning({ id: core_roles.id });

    await saveLanguageWords(c, {
      pluginCode: "core",
      tableName: "core_roles",
      variable: "name",
      itemId: role.id,
      values: name,
    });

    return c.json({ id: role.id }, 201);
  },
});
