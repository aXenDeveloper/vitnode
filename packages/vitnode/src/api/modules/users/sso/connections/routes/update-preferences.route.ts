import { buildRoute } from "@/api/builders";
import { SsoConnectionModel } from "@/api/models/sso-connection";

import { requireSignedInUser } from "../../../passkeys/lib/failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoPreferencesSchema,
} from "../connections.schema";
import { ssoConnectionFailure } from "../lib/failure";

export const ssoPreferencesRoute = buildRoute({
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
