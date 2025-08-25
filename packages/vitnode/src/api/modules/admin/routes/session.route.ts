import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { CONFIG_PLUGIN } from "@/config";

export const sessionAdminRoute = buildRoute({
  ...CONFIG_PLUGIN,
  route: {
    method: "get",
    description: "Verify admin session",
    path: "/session",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              user: z.object({
                id: z.number(),
                email: z.string(),
                name: z.string(),
                nameCode: z.string(),
                createdAt: z.date(),
                newsletter: z.boolean(),
                avatarColor: z.string(),
                emailVerified: z.boolean(),
                roleId: z.number(),
                birthday: z.date().nullable(),
              }),
              vitnode_version: z.string(),
            }),
          },
        },
        description: "User",
      },
      403: {
        description: "Access Denied",
      },
    },
  },
  handler: c => {
    const user = c.get("admin")?.user;
    if (!user) throw new HTTPException(403);

    return c.json({
      user,
      vitnode_version: CONFIG_PLUGIN.version,
    });
  },
});
