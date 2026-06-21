import { z } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";
import { core_users } from "@/database/users";

const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export const zodUpdateUserAdminSchema = z
  .object({
    email: z.email().toLowerCase().openapi({
      example: "test@test.com",
    }),
    name: z
      .string()
      .min(3)
      .refine(val => nameRegex.test(val), {
        message: "Invalid name",
      })
      .openapi({ example: "test" }),
    nameCode: z
      .string()
      .min(3)
      .max(255)
      .regex(/^[a-zA-Z0-9-]+$/, { message: "Invalid name code" })
      .openapi({ example: "test" }),
  })
  .partial()
  .refine(
    body =>
      body.email !== undefined ||
      body.name !== undefined ||
      body.nameCode !== undefined,
    {
      message: "At least one field is required",
    },
  );

export const updateUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "patch",
    description: "Update a user's name or email by name SEO (Admin only)",
    path: "/{nameCode}",
    request: {
      params: z.object({
        nameCode: z.string().openapi({ example: "test" }),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodUpdateUserAdminSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              name: z.string(),
              email: z.email(),
              nameCode: z.string(),
            }),
          },
        },
        description: "User updated",
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
        description: "User not found",
      },
      409: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Email or name already exists",
      },
    },
  },
  handler: async c => {
    const { nameCode } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const [user] = await db
      .select({ id: core_users.id })
      .from(core_users)
      .where(eq(core_users.nameCode, nameCode))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const values: Partial<typeof core_users.$inferInsert> = {};

    if (body.email !== undefined) {
      const [existing] = await db
        .select({ id: core_users.id })
        .from(core_users)
        .where(
          and(eq(core_users.email, body.email), ne(core_users.id, user.id)),
        )
        .limit(1);

      if (existing) {
        return c.json({ error: "Email already exists" }, 409);
      }

      values.email = body.email;
    }

    if (body.name !== undefined) {
      const [existing] = await db
        .select({ id: core_users.id })
        .from(core_users)
        .where(and(eq(core_users.name, body.name), ne(core_users.id, user.id)))
        .limit(1);

      if (existing) {
        return c.json({ error: "Name already exists" }, 409);
      }

      values.name = body.name;
    }

    if (body.nameCode !== undefined) {
      // The name code is the user's URL identifier (`@mention` handle), so it
      // must stay globally unique.
      const [existing] = await db
        .select({ id: core_users.id })
        .from(core_users)
        .where(
          and(
            eq(core_users.nameCode, body.nameCode),
            ne(core_users.id, user.id),
          ),
        )
        .limit(1);

      if (existing) {
        return c.json({ error: "Name code already exists" }, 409);
      }

      values.nameCode = body.nameCode;
    }

    const [updated] = await db
      .update(core_users)
      .set(values)
      .where(eq(core_users.id, user.id))
      .returning({
        id: core_users.id,
        name: core_users.name,
        email: core_users.email,
        nameCode: core_users.nameCode,
      });

    return c.json(updated, 200);
  },
});
