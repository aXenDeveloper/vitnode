import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";
import { SSO_CONNECTION_INTENTS } from "@/lib/sso-profile";

import { requireSignedInUser } from "../../../passkeys/failure";
import { ssoConnectionFailure } from "../failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoFieldOutcomes,
  zodSsoProviderIdParam,
} from "../schema";

export const zodSsoConnectionCallbackSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().min(16).max(256),
});

export const ssoConnectionCallbackRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Finish a provider round trip started from settings - connect, import or sync. The state must belong to the signed-in user, this provider and this intent, and works once.",
    path: "/{providerId}/callback",
    request: {
      params: z.object({ providerId: zodSsoProviderIdParam }),
      body: {
        required: true,
        content: {
          "application/json": { schema: zodSsoConnectionCallbackSchema },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              intent: z.enum(SSO_CONNECTION_INTENTS),
              providerId: z.string(),
              results: zodSsoFieldOutcomes.optional(),
            }),
          },
        },
        description:
          "The account was connected, or its profile is ready to review",
      },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { providerId } = c.req.valid("param");
    const { code, state } = c.req.valid("json");

    try {
      return c.json(
        await new SsoConnectionModel(c).callback({
          code,
          providerId,
          state,
          user,
        }),
        200,
      );
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
