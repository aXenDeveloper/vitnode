import { buildRoute } from "@/api/lib/route";
import { PasskeyModel } from "@/api/models/passkey";
import { CONFIG_PLUGIN } from "@/config";

import { passkeyFailure } from "../failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyAuthenticationOptionsSchema,
} from "../schema";

export const passkeyAuthenticationOptionsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Start signing in with a passkey. No email is needed - the browser offers the passkeys it holds for this site.",
    path: "/sign-in/options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodPasskeyAuthenticationOptionsSchema,
          },
        },
        description: "WebAuthn request options for the browser",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    try {
      const options = await new PasskeyModel(c).authenticationOptions(
        "authentication",
      );

      return c.json(options, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
