import { buildRoute } from "@/api/builders";
import { SsoConnectionModel } from "@/api/models/sso-connection";

import { requireSignedInUser } from "../../../passkeys/lib/failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoProviderParams,
} from "../connections.schema";

export const ssoDiscardImportRoute = buildRoute({
  route: {
    method: "delete",
    description: "Throw away the signed-in user's pending import preview.",
    path: "/{providerId}/import",
    request: { params: zodSsoProviderParams },
    responses: {
      200: { description: "Preview discarded" },
      ...SSO_CONNECTION_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireSignedInUser(c.get("user"));
    const { providerId } = c.req.valid("param");

    await new SsoConnectionModel(c).discardPreview({
      providerId,
      userId: user.id,
    });

    return c.body(null, 200);
  },
});
