import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { PasskeyModel } from "@/api/models/passkey";

import { passkeyFailure, requireSignedInUser } from "../failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyIdParam,
  zodPasskeyNameSchema,
  zodPasskeySchema,
} from "../schema";

export const renamePasskeyRoute = buildRoute({
  route: {
    method: "patch",
    description: "Rename one of the signed-in user's passkeys.",
    path: "/{id}",
    request: {
      params: z.object({ id: zodPasskeyIdParam }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({ name: zodPasskeyNameSchema }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ passkey: zodPasskeySchema }),
          },
        },
        description: "Passkey renamed",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");

    try {
      const passkey = await new PasskeyModel(c).renamePasskey({
        id: Number(id),
        name,
        userId: user.id,
      });

      return c.json({ passkey }, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
