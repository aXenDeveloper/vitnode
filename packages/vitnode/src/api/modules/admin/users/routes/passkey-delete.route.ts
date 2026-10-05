import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { PasskeyModel } from "@/api/models/passkey";
import { passkeyFailure } from "@/api/modules/users/passkeys/failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyIdParam,
} from "@/api/modules/users/passkeys/schema";
import { CONFIG_PLUGIN } from "@/config";

import { assertCanEditAdminTarget } from "../lib/assert-edit-user-permission";
import {
  findTargetUserId,
  USER_NOT_FOUND,
  userNotFoundResponse,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const deleteUserPasskeyAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "users", permission: "can_edit" },
  route: {
    method: "delete",
    description:
      "Remove one of a user's passkeys. Refused when it is the account's last way to sign in (Admin only)",
    path: "/{id}/passkeys/{passkeyId}",
    request: {
      params: z.object({
        id: zodTargetUserIdParam,
        passkeyId: zodPasskeyIdParam,
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.literal(true) }),
          },
        },
        description: "Passkey removed",
      },
      ...PASSKEY_ERROR_RESPONSES,
      404: {
        ...userNotFoundResponse,
        description: "Unknown user, unknown passkey, or passkeys are disabled",
      },
    },
  },
  handler: async c => {
    const { id, passkeyId } = c.req.valid("param");
    const userId = await findTargetUserId(c, id);
    if (userId === null) return c.json(USER_NOT_FOUND, 404);

    await assertCanEditAdminTarget(c, userId);

    try {
      await new PasskeyModel(c).deletePasskey({
        id: Number(passkeyId),
        userId,
      });

      return c.json({ ok: true as const }, 200);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
