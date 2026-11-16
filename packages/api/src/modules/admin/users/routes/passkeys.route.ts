import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { coreStaffPermissions } from "@/lib/core-staff-permissions";
import { PasskeyModel } from "@/models/passkey";
import { passkeyFailure } from "@/modules/users/passkeys/lib/failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeySchema,
} from "@/modules/users/passkeys/passkeys.schema";

import {
  findTargetUserId,
  USER_NOT_FOUND,
  userNotFoundResponse,
  zodTargetUserIdParam,
} from "../lib/target-user";

export const listUserPasskeysAdminRoute = buildRoute({
  adminStaffPermission: coreStaffPermissions.admin.users.canView,
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
