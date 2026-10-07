import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { SessionModel } from "@/api/models/session";
import { SSOModel } from "@/api/models/sso";
import { CONFIG_PLUGIN } from "@/config";

export const callbackRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "SSO Callback",
    path: "/{providerId}/callback",
    request: {
      params: z.object({
        providerId: z.string(),
      }),
      query: z.object({
        code: z.string(),
        state: z.string(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
            }),
          },
        },
        description: "URL",
      },
      409: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string(),
              hasPassword: z.boolean(),
              linkToken: z.string(),
            }),
          },
        },
        description:
          "An account with this email already exists; the body carries what the link step needs",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const { code, state } = c.req.valid("query");
    const outcome = await new SSOModel(c).callback({ providerId, code, state });

    if (outcome.kind === "link_required") {
      return c.json(
        {
          email: outcome.email,
          hasPassword: outcome.hasPassword,
          linkToken: outcome.linkToken,
        },
        409,
      );
    }

    // The session lives in the HttpOnly cookie only - see the sign-in route.
    await new SessionModel(c).createSessionByUserId(outcome.userId);

    return c.json({ id: outcome.userId }, 200);
  },
});
