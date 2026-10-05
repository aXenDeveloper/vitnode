import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { PasskeyModel } from "@/api/models/passkey";
import { passkeyFailure } from "@/api/modules/users/passkeys/failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeySchema,
} from "@/api/modules/users/passkeys/schema";
import { CONFIG_PLUGIN } from "@/config";

import {
  findTargetUserId,
  USER_NOT_FOUND,
  userNotFoundResponse,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const listUserPasskeysAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_view" },
  route: {
    method: "get",
    description: "List a user's passkeys (Admin only)",
    path: "/{id}/passkeys",
    request: {
      params: z.object({ id: zodTargetUserIdParam }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ items: z.array(zodPasskeySchema) }),
          },
        },
        description: "The user's passkeys",
      },
      ...PASSKEY_ERROR_RESPONSES,
      404: {
        ...userNotFoundResponse,
        description: "Unknown user, or passkeys are disabled",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const userId = await findTargetUserId(c, id);
    if (userId === null) return c.json(USER_NOT_FOUND, 404);

    try {
      const items = await new PasskeyModel(c).listPasskeys(userId);

      return c.json({ items }, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
