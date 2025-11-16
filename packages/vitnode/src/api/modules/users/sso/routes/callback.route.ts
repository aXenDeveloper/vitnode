import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { SessionModel } from "@/api/models/session";
import { SSOModel } from "@/api/models/sso";

export const callbackRoute = buildRoute({
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
              token: z.string(),
            }),
          },
        },
        description: "URL",
      },
      409: {
        description: "Email already exists",
      },
    },
  },
  handler: async c => {
    const { providerId } = c.req.valid("param");
    const { code, state } = c.req.valid("query");
    const sso = await new SSOModel(c).callback({ providerId, code, state });
    const { token } = await new SessionModel(c).createSessionByUserId(
      sso.userId,
    );

    return c.json({ id: sso.userId, token });
  },
});
