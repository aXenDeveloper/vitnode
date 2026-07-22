import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";

import { zodRoleNameSchema } from "./create.route";

export const zodUpdateRoleAdminSchema = z
  .object({
    name: zodRoleNameSchema,
    color: z.string().max(50),
  })
  .partial()
  .refine(body => Object.values(body).some(value => value !== undefined), {
    message: "At least one field is required",
  });

export const updateRoleAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "patch",
    description: "Update a role by id (Admin only)",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().openapi({ example: "1" }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodUpdateRoleAdminSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Role updated",
      },
      403: {
        description: "Access Denied",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Role not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const roleId = Number(id);
    if (!Number.isInteger(roleId)) {
      return c.json({ error: "Role not found" }, 404);
    }

    const [role] = await db
      .select({ id: core_roles.id })
      .from(core_roles)
      .where(eq(core_roles.id, roleId))
      .limit(1);

    if (!role) {
      return c.json({ error: "Role not found" }, 404);
    }

    const values: Partial<typeof core_roles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.color !== undefined) {
      values.color = body.color.trim() ? body.color : null;
    }

    await db.update(core_roles).set(values).where(eq(core_roles.id, roleId));

    if (body.name !== undefined) {
      await saveLanguageWords(c, {
        pluginCode: "core",
        tableName: "core_roles",
        variable: "name",
        itemId: roleId,
        values: body.name,
      });
    }

    await c.get("events").emit("role.updated", { roleId });

    return c.json({ id: roleId }, 200);
  },
});
