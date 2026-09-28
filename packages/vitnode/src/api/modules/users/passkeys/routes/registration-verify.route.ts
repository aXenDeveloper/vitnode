import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { PasskeyModel } from "@/api/models/passkey";
import { CONFIG_PLUGIN } from "@/config";

import { passkeyFailure, requireSignedInUser } from "../failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyNameSchema,
  zodPasskeyRegistrationResponseSchema,
  zodPasskeySchema,
} from "../schema";

export const passkeyRegistrationVerifyRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Finish adding a passkey. Verifies the attestation against the challenge issued to this browser and account.",
    path: "/register",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              name: zodPasskeyNameSchema.optional(),
              response: zodPasskeyRegistrationResponseSchema,
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ passkey: zodPasskeySchema }),
          },
        },
        description: "Passkey saved",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { name, response } = c.req.valid("json");

    try {
      const passkey = await new PasskeyModel(c).verifyRegistration({
        name,
        response,
        userId: user.id,
      });

      return c.json({ passkey }, 201);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
