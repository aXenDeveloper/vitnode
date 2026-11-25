import { z } from "zod";

import { buildRoute } from "@/builders";
import {
  holdSignInForAccountDeletion,
  zodAccountDeletionHold,
} from "@/lib/account-deletion/sign-in-hold";
import { assertPasswordSignInEnabled } from "@/lib/password-sign-in";
import { SessionModel } from "@/models/session";
import { SSOModel } from "@/models/sso";

import { USER_PASSWORD_MAX_LENGTH } from "../../lib/credential-limits";

export const zodSsoLinkSchema = z.object({
  password: z
    .string()
    .min(1)
    .max(USER_PASSWORD_MAX_LENGTH)
    .openapi({ example: "Test123!" }),
  token: z.string().min(16).max(2048),
});

export const linkRoute = buildRoute({
  termsAcceptance: "exempt",
  route: {
    method: "post",
    description:
      "Link an SSO identity to the existing account it shares an email with, proving ownership with that account's password",
    path: "/{providerId}/link",
    request: {
      params: z.object({
        providerId: z.string(),
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSsoLinkSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
            }),
          },
        },
        description: "Identity linked and user signed in",
      },
      400: {
        description: "The link token is invalid or has expired",
      },
      403: {
        content: {
          "application/json": { schema: zodAccountDeletionHold },
        },
        description:
          "Wrong password (no body). For an account scheduled for deletion the identity is linked but no session starts: `{ error: 'account_deletion_pending', scheduledAt, token }` until `POST /sign_in/cancel-deletion` confirms with that token",
      },
      409: {
        description: "The provider account is already linked to another user",
      },
    },
  },
  handler: async c => {
    assertPasswordSignInEnabled(c);
    const { providerId } = c.req.valid("param");
    const { password, token } = c.req.valid("json");
    const { userId } = await new SSOModel(c).link({
      password,
      providerId,
      token,
    });
    const hold = await holdSignInForAccountDeletion(c, userId);
    if (hold) return c.json(hold, 403);

    await new SessionModel(c).createSessionByUserId(userId);

    return c.json({ id: userId }, 201);
  },
});
