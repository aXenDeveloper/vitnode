import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { PasskeyModel } from "@/api/models/passkey";
import { CONFIG_PLUGIN } from "@/config";

import { passkeyFailure, requireSignedInUser } from "../failure";
import { PASSKEY_ERROR_RESPONSES, zodPasskeyIdParam } from "../schema";

export const deletePasskeyRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "delete",
    description:
      "Remove one of the signed-in user's passkeys. Refused when it is the account's last way to sign in.",
    path: "/{id}",
    request: {
      params: z.object({ id: zodPasskeyIdParam }),
    },
    responses: {
      200: { description: "Passkey removed" },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { id } = c.req.valid("param");

    try {
      await new PasskeyModel(c).deletePasskey({
        id: Number(id),
        userId: user.id,
      });

      return c.body(null, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
