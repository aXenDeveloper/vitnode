import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { PasskeyModel } from "@/api/models/passkey";
import { CONFIG_PLUGIN } from "@/config";

import { passkeyFailure, requireSignedInUser } from "../failure";
import { PASSKEY_ERROR_RESPONSES, zodPasskeySchema } from "../schema";

export const listPasskeysRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "List the signed-in user's passkeys.",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              passkeys: z.array(zodPasskeySchema),
            }),
          },
        },
        description: "The current user's passkeys",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));

    try {
      const passkeys = await new PasskeyModel(c).listPasskeys(user.id);

      return c.json({ passkeys }, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
