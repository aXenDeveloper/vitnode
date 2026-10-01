import { z } from "@hono/zod-openapi";

import { isStaff } from "@/api/lib/check-staff-permission";
import { buildRoute } from "@/api/lib/route";
import { PasskeyError, PasskeyModel } from "@/api/models/passkey";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONFIG_PLUGIN } from "@/config";

import { passkeyFailure } from "../failure";
import {
  PASSKEY_ERROR_RESPONSES,
  zodPasskeyAuthenticationResponseSchema,
} from "../schema";

export const passkeyAdminSignInVerifyRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Finish signing in to the AdminCP with a user-verified passkey and start an AdminCP session. The account must hold staff access right now; a public session is never read or upgraded.",
    path: "/admin-sign-in",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              response: zodPasskeyAuthenticationResponseSchema,
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number() }),
          },
        },
        description: "Signed in to the AdminCP",
      },
      ...PASSKEY_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const { response } = c.req.valid("json");

    try {
      const { userId } = await new PasskeyModel(c).verifyAuthentication(
        response,
        "admin_sign_in",
      );
      if (!(await isStaff(c, { live: true, type: "admin", userId }))) {
        throw new PasskeyError("not_staff", 403);
      }
      await new SessionAdminModel(c).createSessionByUserId(userId);

      return c.json({ id: userId }, 201);
    } catch (error) {
      return passkeyFailure(c, error);
    }
  },
});
