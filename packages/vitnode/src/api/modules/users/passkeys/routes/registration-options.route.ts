import { buildRoute } from "@/api/builders";
import { PasskeyModel } from "@/api/models/passkey";

import { passkeyFailure, requireSignedInUser } from "../failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyRegistrationOptionsSchema,
} from "../schema";

export const passkeyRegistrationOptionsRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Start adding a passkey to the signed-in account. Sets a short-lived challenge cookie.",
    path: "/register/options",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodPasskeyRegistrationOptionsSchema,
          },
        },
        description: "WebAuthn creation options for the browser",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));

    try {
      const options = await new PasskeyModel(c).registrationOptions(user);

      return c.json(options, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
