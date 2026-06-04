import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { PasswordModel } from "@/api/models/password";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";

const nameRegex = /^(?!.* {2})[\p{L}\p{N}._@ -]*$/u;

export const zodCreateUserAdminSchema = z.object({
  email: z.email().toLowerCase().openapi({
    example: "test@test.com",
  }),
  name: z
    .string()
    .openapi({ example: "test" })
    .min(3)
    .refine(val => nameRegex.test(val), {
      message: "Invalid name",
    }),
  password: z.string().min(8).openapi({
    example: "Test123!",
  }),
});

export const createUserAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description: "Create a new user (Admin only)",
    path: "/create",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodCreateUserAdminSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              name: z.string(),
              email: z.email(),
            }),
          },
        },
        description: "User created",
      },
      403: {
        description: "Access Denied",
      },
      409: {
        description: "Email or name already exists",
      },
    },
  },
  handler: async c => {
    const { password, ...input } = c.req.valid("json");
    const hashedPassword = await new PasswordModel().encryptPassword(password);
    const data = await new UserModel().signUp({ ...input, hashedPassword }, c);

    return c.json(
      {
        id: data.id,
        name: data.name,
        email: data.email,
      },
      201,
    );
  },
});
