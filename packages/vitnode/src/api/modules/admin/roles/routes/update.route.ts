import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { saveLanguageWords } from "@/api/lib/save-language-words";
import { invalidateAllStaffPermissions } from "@/api/lib/staff-permission-cache";
import { CONFIG_PLUGIN } from "@/config";
import { core_roles } from "@/database/roles";

import { assertCanManageAdminRole } from "../lib/assert-manage-admin-role";
import { zodRoleNameSchema, zodRoleStorageSchema } from "./create.route";

export const zodUpdateRoleAdminSchema = z
  .object({
    name: zodRoleNameSchema,
    color: z.string().max(50),
    allowUploadFiles: z.boolean(),
    totalMaxStorage: zodRoleStorageSchema,
    maxStorageForSubmit: zodRoleStorageSchema,
  })
  .partial()
  .refine(body => Object.values(body).some(value => value !== undefined), {
    message: "At least one field is required",
  });

export const updateRoleAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "roles", permission: "can_edit" },
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

    // Editing a role that grants admin access requires the elevated permission.
    await assertCanManageAdminRole(c, { roleId, permission: "can_edit_admin" });

    const values: Partial<typeof core_roles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.color !== undefined) {
      values.color = body.color.trim() ? body.color : null;
    }
    if (body.allowUploadFiles !== undefined) {
      values.allowUploadFiles = body.allowUploadFiles;
    }
    // `null` is a meaningful value here (unlimited), so only skip `undefined`.
    if (body.totalMaxStorage !== undefined) {
      values.totalMaxStorage = body.totalMaxStorage;
    }
    if (body.maxStorageForSubmit !== undefined) {
      values.maxStorageForSubmit = body.maxStorageForSubmit;
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

    // `root` is part of every permission resolution, so an edit here can change
    // the answer for every member of this role at once.
    await invalidateAllStaffPermissions(c);

    await c.get("events").emit("role.updated", { roleId });

    return c.json({ id: roleId }, 200);
  },
});
