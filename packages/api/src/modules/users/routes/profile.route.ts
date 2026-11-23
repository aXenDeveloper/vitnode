import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { buildRoute } from "@/builders";
import { core_users } from "@/database/users";
import { findOpenAccountDeletion } from "@/lib/account-deletion/requests";
import { resolveUserRoles, userRoleSchema } from "@/lib/resolve-user-roles";
import { publicFullNameOf } from "@/lib/user-personal-information";
import { UserModel } from "@/models/user";
import { profileOgImage } from "@/modules/og/lib/profile-card";

export const profileRoute = buildRoute({
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
              /** Points from reactions to the member's content; can be negative. */
              reputation: z.number().int(),
              /** The profile's social card, or `null` when cards are off. */
              ogImage: z
                .object({
                  alt: z.string(),
                  height: z.number().int(),
                  type: z.string(),
                  url: z.string(),
                  width: z.number().int(),
                })
                .nullable(),
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

    if (
      c.get("user")?.id !== user.id &&
      (await findOpenAccountDeletion(c, user.id))
    ) {
      return c.json({ error: "User not found" }, 404);
    }

    const roles = await resolveUserRoles(c, user);
    const [standing] = await c
      .get("db")
      .select({ reputation: core_users.reputation })
      .from(core_users)
      .where(eq(core_users.id, user.id))
      .limit(1);

    return c.json(
      {
        id: user.id,
        name:
          publicFullNameOf(user, c.get("core").personalInformationFields) ??
          user.name,
        nameCode: user.nameCode,
        headline: c.get("core").personalInformationFields.headline
          ? user.headline
          : null,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        coverUrl: user.coverUrl,
        createdAt: user.createdAt,
        reputation: standing?.reputation ?? 0,
        ogImage: profileOgImage(c, user),
        ...roles,
      },
      200,
    );
  },
});
