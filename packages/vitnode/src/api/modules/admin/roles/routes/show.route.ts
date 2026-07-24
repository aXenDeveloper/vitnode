import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_languages_words } from "@/database/languages";
import { core_roles } from "@/database/roles";

const roleAdminSchema = z.object({
  id: z.number(),
  // Every translation of the role name - resolved to the active locale on the
  // frontend (see the `RoleFormat` component).
  name: z.array(
    z.object({
      name: z.string(),
      languageCode: z.string(),
    }),
  ),
  color: z.string().nullable(),
  protected: z.boolean(),
  default: z.boolean(),
  root: z.boolean(),
  guest: z.boolean(),
  allowUploadFiles: z.boolean(),
  totalMaxStorage: z.number().nullable(),
  maxStorageForSubmit: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const showRoleAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Get a single role by id (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: roleAdminSchema,
          },
        },
        description: "Role found",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
        description: "Role not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const roleId = Number(id);
    if (!Number.isInteger(roleId)) {
      return c.json({ error: "Role not found" }, 404);
    }

    const [role] = await c
      .get("db")
      .select({
        id: core_roles.id,
        color: core_roles.color,
        protected: core_roles.protected,
        default: core_roles.default,
        root: core_roles.root,
        guest: core_roles.guest,
        allowUploadFiles: core_roles.allowUploadFiles,
        totalMaxStorage: core_roles.totalMaxStorage,
        maxStorageForSubmit: core_roles.maxStorageForSubmit,
        createdAt: core_roles.createdAt,
      })
      .from(core_roles)
      .where(eq(core_roles.id, roleId))
      .limit(1);

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    const names = await c
      .get("db")
      .select({
        languageCode: core_languages_words.languageCode,
        value: core_languages_words.value,
      })
      .from(core_languages_words)
      .where(
        and(
          eq(core_languages_words.tableName, "core_roles"),
          eq(core_languages_words.variable, "name"),
          eq(core_languages_words.pluginCode, "core"),
          eq(core_languages_words.itemId, roleId),
        ),
      );

    return c.json(
      {
        ...role,
        name: names.map(word => ({
          name: word.value,
          languageCode: word.languageCode,
        })),
      },
      200,
    );
  },
});
