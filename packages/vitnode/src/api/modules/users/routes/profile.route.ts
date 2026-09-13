import { z } from "@hono/zod-openapi";

import { resolveUserRoles, userRoleSchema } from "@/api/lib/resolve-user-roles";
import { buildRoute } from "@/api/lib/route";
import { UserModel } from "@/api/models/user";
import { CONFIG_PLUGIN } from "@/config";
import { displayNameOf } from "@/lib/user-personal-information";

export const profileRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "Public profile of a user, looked up by their URL name",
    path: "/profile/{nameCode}",
    request: {
      params: z.object({
        nameCode: z.string().min(1).max(255).openapi({ example: "aXen" }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              name: z.string(),
              nameCode: z.string(),
              headline: z.string().nullable(),
              avatarColor: z.string(),
              avatarUrl: z.string().nullable(),
              coverUrl: z.string().nullable(),
              createdAt: z.date(),
              role: userRoleSchema,
              secondaryRoles: z.array(userRoleSchema),
            }),
          },
        },
        description: "Public profile",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
        description: "User not found",
      },
    },
  },
  handler: async c => {
    const { nameCode } = c.req.valid("param");

    const user = await new UserModel().getUserByNameCode({ c, nameCode });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const roles = await resolveUserRoles(c, user);

    return c.json(
      {
        id: user.id,
        name: displayNameOf({
          ...user,
          showRealName:
            c.get("core").personalInformationFields.showRealName &&
            user.showRealName,
        }),
        nameCode: user.nameCode,
        headline: c.get("core").personalInformationFields.headline
          ? user.headline
          : null,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        createdAt: user.createdAt,
        ...roles,
      },
      200,
    );
  },
});
