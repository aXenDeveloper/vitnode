import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/lib/route";
import { SsoConnectionModel } from "@/api/models/sso-connection";
import { CONFIG_PLUGIN } from "@/config";
import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import { requireSignedInUser } from "../../../passkeys/failure";
import { ssoConnectionFailure } from "../failure";
import {
  SSO_CONNECTION_ERROR_RESPONSES,
  zodSsoImportPreview,
  zodSsoImportResult,
  zodSsoProfileField,
  zodSsoProviderIdParam,
} from "../schema";

const params = z.object({ providerId: zodSsoProviderIdParam });

export const ssoImportPreviewRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "The profile values fetched by the signed-in user's last import round trip, next to the current ones.",
    path: "/{providerId}/import",
    request: { params },
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

export const zodSsoApplyImportSchema = z.object({
  fields: z.array(zodSsoProfileField).min(1).max(SSO_PROFILE_FIELDS.length),
});

export const ssoApplyImportRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "post",
    description:
      "Copy the selected fields of the import preview onto the signed-in user's profile. The preview works once.",
    path: "/{providerId}/import",
    request: {
      params,
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

export const ssoDiscardImportRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "delete",
    description: "Throw away the signed-in user's pending import preview.",
    path: "/{providerId}/import",
    request: { params },
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
