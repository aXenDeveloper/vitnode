import { buildRoute } from "@/api/builders";
import { SsoConnectionModel } from "@/api/models/sso-connection";

import { requireSignedInUser } from "../../../passkeys/lib/failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoImportPreview,
  zodSsoProviderParams,
} from "../connections.schema";
import { ssoConnectionFailure } from "../lib/failure";

export const ssoImportPreviewRoute = buildRoute({
  route: {
    method: "get",
    description:
      "The profile values fetched by the signed-in user's last import round trip, next to the current ones.",
    path: "/{providerId}/import",
    request: { params: zodSsoProviderParams },
    responses: {
      200: {
        content: { "application/json": { schema: zodSsoImportPreview } },
        description: "The import preview",
      },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { providerId } = c.req.valid("param");

    try {
      return c.json(
        await new SsoConnectionModel(c).preview({
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
