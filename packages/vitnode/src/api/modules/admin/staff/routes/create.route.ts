import { z } from "@hono/zod-openapi";
import { eq, or } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";

import { staffTypeSchema } from "../lib/schema";

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

export const createStaffAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Create a staff entry for a role or a user (Admin only)",
    path: "/entry/{type}",
    request: {
      params: z.object({
        type: staffTypeSchema,
      }),
      body: {
        content: {
          "application/json": {
            schema: z
              .object({
                roleId: z.number().nullable().optional(),
                userId: z.number().nullable().optional(),
              })
              // Exactly one of role/user must be provided.
              .refine(
                value => Boolean(value.roleId) !== Boolean(value.userId),
                { message: "Provide exactly one of roleId or userId" },
              ),
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
        description: "Staff entry created",
      },
      403: {
        description: "Access Denied",
      },
      409: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Staff entry already exists",
      },
    },
  },
  handler: async c => {
    const { type } = c.req.valid("param");
    const { roleId, userId } = c.req.valid("json");
    const table = tableByType[type];

    // Prevent assigning the same role/user twice.
    const [existing] = await c
      .get("db")
      .select({ id: table.id })
      .from(table)
      .where(
        or(
          roleId ? eq(table.roleId, roleId) : undefined,
          userId ? eq(table.userId, userId) : undefined,
        ),
      )
      .limit(1);

    if (existing) {
      return c.json({ error: "Staff entry already exists" }, 409);
    }

    const [created] = await c
      .get("db")
      .insert(table)
      .values({
        roleId: roleId ?? null,
        userId: userId ?? null,
        data: { unrestricted: false, permissions: [] },
      })
      .returning({ id: table.id });

    return c.json({ id: created.id }, 201);
  },
});
