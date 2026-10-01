import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";

import { requireSignedInUser } from "../../../passkeys/failure";
import { ssoConnectionFailure } from "../failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoProviderIdParam,
} from "../schema";

const zodSource = zodSsoProviderIdParam.nullable().optional();

export const zodSsoPreferencesSchema = z.object({
  sources: z.object({
    avatar: zodSource,
    firstName: zodSource,
    lastName: zodSource,
  }),
  sync: z
    .record(zodSsoProviderIdParam, z.boolean())
    .refine(value => Object.keys(value).length <= 32),
});

export const ssoPreferencesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "put",
    description:
      "Choose which connected provider each profile field comes from (null keeps it managed manually), and whether signing in through a provider updates those fields.",
    path: "/preferences",
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: zodSsoPreferencesSchema } },
      },
    },
    responses: {
      200: { description: "Preferences saved" },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { sources, sync } = c.req.valid("json");

    try {
      await new SsoConnectionModel(c).savePreferences({
        sources,
        sync,
        userId: user.id,
      });

      return c.body(null, 200);
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
