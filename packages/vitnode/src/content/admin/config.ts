import type { ContentTypeFrontendRegistration } from "../../lib/plugin";
import type { VitNodeConfig } from "../../vitnode.config";
import type { AnyContentTypeDefinition } from "../types";

import { getVitNodeConfig } from "../../vitnode.config";
import { validateContentTypes } from "../registry";

export interface RegisteredFrontendContentType {
  definition: AnyContentTypeDefinition;
  pluginId: string;
  registration: ContentTypeFrontendRegistration;
}

/**
 * Every content type registered with the AdminCP, in a deterministic order.
 *
 * Reads the app config rather than a mutable singleton, so hot reload simply
 * re-derives it. The same validation the API side runs applies here, which is
 * what catches a content type registered on only one of the two sides.
 */
export const getFrontendContentTypes = (
  vitNodeConfig: VitNodeConfig = getVitNodeConfig(),
): RegisteredFrontendContentType[] => {
  const entries = vitNodeConfig.plugins.flatMap(plugin =>
    (plugin.contentTypes ?? []).map(registration => ({
      definition: registration.definition,
      pluginId: plugin.pluginId,
      registration,
    })),
  );

  validateContentTypes(
    entries.map(({ definition, pluginId }) => ({ definition, pluginId })),
  );

  return [...entries].sort((a, b) =>
    a.definition.id.localeCompare(b.definition.id),
  );
};

export const findFrontendContentType = (
  contentTypeId: string,
  vitNodeConfig?: VitNodeConfig,
): RegisteredFrontendContentType | undefined =>
  getFrontendContentTypes(vitNodeConfig).find(
    entry => entry.definition.id === contentTypeId,
  );

export const findFrontendContentTypeByAdminPath = (
  adminPath: string,
  vitNodeConfig?: VitNodeConfig,
): RegisteredFrontendContentType | undefined =>
  getFrontendContentTypes(vitNodeConfig).find(
    entry => entry.definition.admin.path === adminPath,
  );
