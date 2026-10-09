import { z } from "zod";

import { assertPasswordSignInEnabled } from "@/api/lib/password-sign-in";
import { buildRoute } from "@/api/lib/route";
import { SessionModel } from "@/api/models/session";
import { SSOModel } from "@/api/models/sso";
import { CONFIG_PLUGIN } from "@/config";

import { USER_PASSWORD_MAX_LENGTH } from "../../credential-limits";

export const zodSsoLinkSchema = z.object({
  password: z
    .string()
    .min(1)
    .max(USER_PASSWORD_MAX_LENGTH)
    .openapi({ example: "Test123!" }),
  token: z.string().min(16).max(2048),
});

export const linkRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
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
        description: "Wrong password",
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
    await new SessionModel(c).createSessionByUserId(userId);

    return c.json({ id: userId }, 201);
  },
});
