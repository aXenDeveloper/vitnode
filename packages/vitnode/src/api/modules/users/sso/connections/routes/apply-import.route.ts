import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import { requireSignedInUser } from "../../../passkeys/lib/failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoImportResult,
  zodSsoProfileField,
  zodSsoProviderParams,
} from "../connections.schema";
import { ssoConnectionFailure } from "../lib/failure";

export const zodSsoApplyImportSchema = z.object({
  fields: z.array(zodSsoProfileField).min(1).max(SSO_PROFILE_FIELDS.length),
});

export const ssoApplyImportRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Copy the selected fields of the import preview onto the signed-in user's profile. The preview works once.",
    path: "/{providerId}/import",
    request: {
      params: zodSsoProviderParams,
      body: {
        required: true,
        content: { "application/json": { schema: zodSsoApplyImportSchema } },
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodSsoImportResult } },
        description: "What happened to each selected field",
      },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { providerId } = c.req.valid("param");
    const { fields } = c.req.valid("json");

    try {
      return c.json(
        await new SsoConnectionModel(c).applyImport({
          fields,
          providerId,
          userId: user.id,
        }),
        200,
      );
    } catch (error) {
      return ssoConnectionFailure(c, error);
    }
  },
});
