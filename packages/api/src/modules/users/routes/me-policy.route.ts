import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/builders";
import {
  resolvePersonalInfoPolicy,
  zodPersonalInfoPolicy,
} from "@/lib/personal-info-policy";
import { BROWSE_ANONYMOUSLY_POLICIES } from "@/lib/user-presence";
import { resolveBrowseAnonymouslyPolicies } from "@/models/user-presence";

export const mePolicyRoute = buildRoute({
  route: {
    method: "get",
    description:
      "What the signed-in user may change on their own account, from their roles.",
    path: "/me/policy",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodPersonalInfoPolicy.extend({
              browseAnonymously: z.enum(BROWSE_ANONYMOUSLY_POLICIES),
            }),
          },
        },
        description: "Account allowances",
      },
      401: {
        description: "Not signed in",
      },
    },
  },
  handler: async c => {
    const user = c.get("user");
    if (!user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const [personalInfo, browseAnonymously] = await Promise.all([
      resolvePersonalInfoPolicy(c, user),
      resolveBrowseAnonymouslyPolicies(c, [user]),
    ]);

    return c.json(
      {
        ...personalInfo,
        browseAnonymously: browseAnonymously.get(user.id) ?? "allowed",
      },
      200,
    );
  },
});
