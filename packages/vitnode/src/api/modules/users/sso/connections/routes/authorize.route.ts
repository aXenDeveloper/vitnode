import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";
import { SSO_CONNECTION_INTENTS, SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import { requireSignedInUser } from "../../../passkeys/failure";
import { ssoConnectionFailure } from "../failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoProfileField,
  zodSsoProviderIdParam,
} from "../schema";

export const zodSsoAuthorizeSchema = z.object({
  fields: z.array(zodSsoProfileField).max(SSO_PROFILE_FIELDS.length).optional(),
  intent: z.enum(SSO_CONNECTION_INTENTS),
});

export const authorizeSsoConnectionRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Start a provider round trip for the signed-in user - to connect a new account, to import chosen profile fields, or to sync the fields sourced from a connected account right away (no sign-out needed).",
    path: "/{providerId}/authorize",
    request: {
      params: z.object({ providerId: zodSsoProviderIdParam }),
      body: {
        required: true,
        content: { "application/json": { schema: zodSsoAuthorizeSchema } },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ url: z.string() }) },
        },
        description: "The provider URL to send the browser to",
      },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { providerId } = c.req.valid("param");
    const { fields, intent } = c.req.valid("json");

    try {
      const { url } = await new SsoConnectionModel(c).authorize({
        fields,
        intent,
        providerId,
        userId: user.id,
      });

      return c.json({ url }, 200);
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
